import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import {
  CfnOutput,
  CustomResource,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
  Token,
  Validations,
  type StackProps,
} from 'aws-cdk-lib';
import { AccessLogFormat } from 'aws-cdk-lib/aws-apigateway';
import {
  HttpApi,
  HttpMethod,
  HttpStage,
  LogGroupLogDestination,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import type { UserPoolClient } from 'aws-cdk-lib/aws-cognito';
import {
  AccountRecovery,
  CfnUserPoolGroup,
  FeaturePlan,
  Mfa,
  UserPool,
  UserPoolOperation,
} from 'aws-cdk-lib/aws-cognito';
import { AttributeType, BillingMode, ProjectionType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { AnyPrincipal, Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Bucket } from 'aws-cdk-lib/aws-s3';
import type { Topic } from 'aws-cdk-lib/aws-sns';
import { Queue, QueueEncryption } from 'aws-cdk-lib/aws-sqs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import type { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';
import { Monitoring } from './monitoring.js';
import { OrderConfirmed } from './order-confirmed.js';
import { RecsPipeline } from './recs-pipeline.js';
import { RecsTable } from './recs-table.js';
import { TrainingData } from './training-data.js';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const API_SRC = path.join(REPO_ROOT, 'services', 'api', 'src');
/** 104 sản phẩm demo (services/api/seed/catalog), nạp tự động khi deploy môi trường không phải prod */
const DEMO_PRODUCTS_FILE = path.join(
  REPO_ROOT,
  'services',
  'api',
  'seed',
  'catalog',
  'products.json',
);

/** Tên GSI, trùng với PRODUCTS_BY_CATEGORY_INDEX trong services/api/src/modules/catalog/infra/. */
export const PRODUCTS_BY_CATEGORY_INDEX = 'byCategory';
/** GSI đơn theo trạng thái cho admin (dynamodb-design.md, bảng orders, Q3). */
export const ORDERS_BY_STATUS_INDEX = 'byStatus';

/** Cách đóng gói chung cho các Lambda API: ESM cho Node 24, đóng gói cả AWS SDK. */
const API_BUNDLING = {
  format: OutputFormat.ESM,
  target: 'node24',
  minify: true,
  sourceMap: true,
  mainFields: ['module', 'main'],
  // Thư viện CommonJS nằm trong bundle ESM vẫn cần `require`
  banner: "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
  // Đóng gói AWS SDK cùng code để cố định phiên bản, không dựa vào bản có sẵn trong runtime
  externalModules: [],
};

export interface ApiStackProps extends StackProps {
  readonly shopEnv: ShopEnvironment;
}

/** API của shop: bảng dữ liệu, Lambda theo từng module, HTTP API. Module mẫu: catalog. */
export class ApiStack extends Stack {
  /** HTTP API của shop; stack web chuyển /api/* sang đây. */
  public readonly httpApi: HttpApi;
  /** JWT authorizer của Cognito; module nào có route cần đăng nhập thì truyền vào addRoutes. */
  public readonly authorizer: HttpUserPoolAuthorizer;
  /** User pool và app client của web; stack web ghi id của chúng vào config.json. */
  public readonly userPool: UserPool;
  public readonly webClient: UserPoolClient;
  /** Bucket dữ liệu huấn luyện đã ẩn danh của pipeline gợi ý mỗi đêm. */
  public readonly trainingDataBucket: Bucket;
  /** Bảng gợi ý; pipeline mỗi đêm của Nhân cấp quyền ghi, API gợi ý của An chỉ đọc. */
  public readonly recsTable: Table;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { shopEnv } = props;
    const removalPolicy = shopEnv.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // Theo docs/business/dynamodb-design.md: khoá chính `productId`; GSI byCategory cho API danh sách.
    // Giữ khớp với services/api/test/helpers/catalog.ts và adapter dynamoProductRepository.ts
    const products = new Table(this, 'ProductsTable', {
      partitionKey: { name: 'productId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: shopEnv.isProd,
      removalPolicy,
    });
    // Danh sách theo loại: khoá `categoryStatus` = "<category>#<status>", vd. "gpu#ACTIVE"
    products.addGlobalSecondaryIndex({
      indexName: PRODUCTS_BY_CATEGORY_INDEX,
      partitionKey: { name: 'categoryStatus', type: AttributeType.STRING },
      sortKey: { name: 'productId', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });

    const catalogFn = new NodejsFunction(this, 'CatalogFunction', {
      entry: path.join(API_SRC, 'modules', 'catalog', 'lambda.ts'),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, 'CatalogLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy,
      }),
      environment: {
        PRODUCTS_TABLE: products.tableName,
        POWERTOOLS_SERVICE_NAME: 'catalog',
        POWERTOOLS_LOG_LEVEL: shopEnv.isProd ? 'INFO' : 'DEBUG',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: API_BUNDLING,
    });
    // Quyền tối thiểu: GetItem trên bảng (chi tiết), Query chỉ trên GSI byCategory (danh sách). Không Scan.
    catalogFn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:GetItem'], resources: [products.tableArn] }),
    );
    catalogFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:Query'],
        resources: [`${products.tableArn}/index/${PRODUCTS_BY_CATEGORY_INDEX}`],
      }),
    );
    Tags.of(products).add('module', 'catalog');
    Tags.of(catalogFn).add('module', 'catalog');
    Validations.of(catalogFn).acknowledge({
      id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
      reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
    });
    Validations.of(catalogFn).acknowledge({
      id: 'AwsSolutions-IAM5[Resource::*]',
      reason: 'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
    });

    // Health chỉ báo API còn sống: không đọc dữ liệu, nên không cấp quyền DynamoDB nào
    const healthFn = this.noDataFunction('Health', 'health', removalPolicy);

    const httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `${shopEnv.stackPrefix}-api`,
      createDefaultStage: false,
    });
    this.httpApi = httpApi;
    const accessLogs = new LogGroup(this, 'ApiAccessLogs', {
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy,
    });
    new HttpStage(this, 'DefaultStage', {
      httpApi,
      stageName: '$default',
      autoDeploy: true,
      // Chặn spam làm tăng chi phí; load test ở staging thì nâng tạm
      throttle: { rateLimit: 50, burstLimit: 100 },
      accessLogSettings: {
        destination: new LogGroupLogDestination(accessLogs),
        format: AccessLogFormat.custom(
          JSON.stringify({
            requestId: '$context.requestId',
            ip: '$context.identity.sourceIp',
            requestTime: '$context.requestTime',
            routeKey: '$context.routeKey',
            status: '$context.status',
            responseLength: '$context.responseLength',
            integrationLatency: '$context.integrationLatency',
            integrationError: '$context.integrationErrorMessage',
          }),
        ),
      },
    });

    const catalogIntegration = new HttpLambdaIntegration('CatalogIntegration', catalogFn);
    const catalogRoutes = [
      ...httpApi.addRoutes({
        path: '/api/v1/products',
        methods: [HttpMethod.GET],
        integration: catalogIntegration,
      }),
      ...httpApi.addRoutes({
        path: '/api/v1/products/{productId}',
        methods: [HttpMethod.GET],
        integration: catalogIntegration,
      }),
    ];
    for (const route of catalogRoutes) {
      Validations.of(route).acknowledge({
        id: 'AwsSolutions::AwsSolutions-APIG4',
        reason:
          'Xem sản phẩm là công khai. Route cần đăng nhập dùng JWT authorizer của Cognito (ADR-0007).',
      });
    }

    const [healthRoute] = httpApi.addRoutes({
      path: '/api/v1/health',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('HealthIntegration', healthFn),
    });
    Validations.of(healthRoute!).acknowledge({
      id: 'AwsSolutions::AwsSolutions-APIG4',
      reason: 'Health là công khai để smoke test và giám sát gọi được; không trả dữ liệu gì.',
    });

    // Đăng nhập (ADR-0007): route nào cần đăng nhập thì gắn this.authorizer
    const auth = this.addCognito(shopEnv, removalPolicy);
    this.userPool = auth.userPool;
    this.webClient = auth.webClient;
    this.authorizer = auth.authorizer;
    const accountFn = this.noDataFunction('Account', 'account', removalPolicy);
    httpApi.addRoutes({
      path: '/api/v1/me',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('AccountIntegration', accountFn),
      authorizer: this.authorizer,
    });

    // Giỏ hàng (cart.md): mọi route cần đăng nhập
    const { cartFn, carts } = this.addCart(shopEnv, removalPolicy, httpApi, products);

    // Đặt hàng (ordering.md): mọi route cần đăng nhập
    const ordering = this.addOrdering(shopEnv, removalPolicy, httpApi, products, carts);

    // Sự kiện hành vi cho gợi ý (events.md): ghi VIEW, ADD_TO_CART, cần đăng nhập
    const { eventsFn, events } = this.addEvents(shopEnv, removalPolicy, httpApi);

    // Prod cũng có sản phẩm demo vì chưa có trang admin, nhưng chỉ thêm sản phẩm còn thiếu
    this.seedDemoProducts(products, removalPolicy, shopEnv.isProd ? 'insert-missing' : 'overwrite');

    // Dữ liệu huấn luyện cho pipeline gợi ý mỗi đêm (module recommendation)
    this.trainingDataBucket = new TrainingData(this, 'TrainingData', { shopEnv }).bucket;
    this.recsTable = new RecsTable(this, 'Recs', { shopEnv }).table;
    new CfnOutput(this, 'RecsTableName', { value: this.recsTable.tableName });

    // API gợi ý (recommendation.md): also-bought, bestsellers công khai; for-you cần đăng nhập
    const recsFn = this.addRecommendation(
      shopEnv,
      removalPolicy,
      httpApi,
      products,
      this.recsTable,
    );

    // Tin đơn đã xác nhận (ordering.md bước 2.3): ordering gửi, events nhận qua hàng đợi có DLQ
    const orderConfirmed = new OrderConfirmed(this, 'OrderConfirmed');
    new CfnOutput(this, 'OrderConfirmedTopicArn', { value: orderConfirmed.topic.topicArn });
    new CfnOutput(this, 'EventsPurchaseQueueUrl', { value: orderConfirmed.eventsQueue.queueUrl });
    // events.md mục 1: consumer ghi mỗi món của đơn đã xác nhận thành một PURCHASE
    this.addPurchaseConsumer(shopEnv, removalPolicy, events, orderConfirmed.eventsQueue);

    // Job gợi ý mỗi đêm (recommendation.md mục 3): đọc products, events, ghi bảng recs
    const recsPipeline = new RecsPipeline(this, 'RecsPipeline', {
      shopEnv,
      removalPolicy,
      recs: this.recsTable,
      products,
      events,
    });
    // Worker order-processor (ordering.md, luồng SQS): xác nhận đơn, gửi tin order-confirmed
    const orderProcessorFn = this.addOrderProcessor(
      shopEnv,
      removalPolicy,
      ordering.orders,
      ordering.queue,
      orderConfirmed.topic,
    );

    // Giám sát: SNS topic nhận cảnh báo; email truyền bằng -c alarmEmail=..., không ghi vào repo public
    const alarmEmail: unknown = this.node.tryGetContext('alarmEmail');
    new Monitoring(this, 'Monitoring', {
      shopEnv,
      httpApi,
      preSignUpFn: auth.preSignUpFn,
      apiFunctions: {
        catalog: catalogFn,
        cart: cartFn,
        ordering: ordering.fn,
        events: eventsFn,
        recommendation: recsFn,
        account: accountFn,
        health: healthFn,
      },
      workerFunctions: { 'order-processor': orderProcessorFn, 'recs-pipeline': recsPipeline.fn },
      recsPipelineFn: recsPipeline.fn,
      ordersQueue: ordering.queue,
      ordersDeadLetterQueue: ordering.deadLetterQueue,
      ...(typeof alarmEmail === 'string' && alarmEmail !== '' ? { alarmEmail } : {}),
    });
    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'ProductsTableName', { value: products.tableName });
  }

  /**
   * Module cart: bảng carts (mỗi người một item, khoá userId) và Lambda cart.
   * Quyền tối thiểu: GetItem, PutItem trên carts; đọc products CHỈ bằng BatchGetItem trên ARN bảng,
   * không gồm index (ngoại lệ có ghi lại ở ADR-0017); bảng cart-idempotency riêng cho gộp giỏ.
   * Mọi route gắn JWT authorizer của Cognito.
   */
  private addCart(
    shopEnv: ShopEnvironment,
    removalPolicy: RemovalPolicy,
    httpApi: HttpApi,
    products: Table,
  ) {
    const carts = new Table(this, 'CartsTable', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      deletionProtection: shopEnv.isProd,
      removalPolicy,
    });
    Validations.of(carts).acknowledge({
      id: 'AwsSolutions::AwsSolutions-DDB3',
      reason:
        'Theo ADR-0012 chỉ orders và products bật point-in-time recovery; giỏ hàng mất thì khách thêm lại được.',
    });
    // Chống gộp giỏ hai lần (ADR-0017): schema Powertools Idempotency, khoá `id`, TTL `expiration`
    const cartIdempotency = new Table(this, 'CartIdempotencyTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiration',
      removalPolicy: RemovalPolicy.DESTROY,
    });
    Validations.of(cartIdempotency).acknowledge({
      id: 'AwsSolutions::AwsSolutions-DDB3',
      reason:
        'Bản ghi chống gộp hai lần chỉ sống 24 giờ, mất thì không ảnh hưởng gì; không cần sao lưu.',
    });

    const cartFn = new NodejsFunction(this, 'CartFunction', {
      entry: path.join(API_SRC, 'modules', 'cart', 'lambda.ts'),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, 'CartLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy,
      }),
      environment: {
        CARTS_TABLE: carts.tableName,
        PRODUCTS_TABLE: products.tableName,
        CART_IDEMPOTENCY_TABLE: cartIdempotency.tableName,
        POWERTOOLS_SERVICE_NAME: 'cart',
        POWERTOOLS_LOG_LEVEL: shopEnv.isProd ? 'INFO' : 'DEBUG',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: API_BUNDLING,
    });
    cartFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:PutItem'],
        resources: [carts.tableArn],
      }),
    );
    cartFn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:BatchGetItem'], resources: [products.tableArn] }),
    );
    // Các thao tác Powertools Idempotency cần, chỉ trên bảng idempotency của chính cart
    cartFn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
        ],
        resources: [cartIdempotency.tableArn],
      }),
    );
    Tags.of(carts).add('module', 'cart');
    Tags.of(cartIdempotency).add('module', 'cart');
    Tags.of(cartFn).add('module', 'cart');
    Validations.of(cartFn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
      },
    );

    const integration = new HttpLambdaIntegration('CartIntegration', cartFn);
    httpApi.addRoutes({
      path: '/api/v1/cart',
      methods: [HttpMethod.GET],
      integration,
      authorizer: this.authorizer,
    });
    httpApi.addRoutes({
      path: '/api/v1/cart/items',
      methods: [HttpMethod.POST],
      integration,
      authorizer: this.authorizer,
    });
    httpApi.addRoutes({
      path: '/api/v1/cart/merge',
      methods: [HttpMethod.POST],
      integration,
      authorizer: this.authorizer,
    });
    httpApi.addRoutes({
      path: '/api/v1/cart/items/{productId}',
      methods: [HttpMethod.PUT, HttpMethod.DELETE],
      integration,
      authorizer: this.authorizer,
    });

    new CfnOutput(this, 'CartsTableName', { value: carts.tableName });
    return { cartFn, carts };
  }

  /**
   * Module ordering (ordering.md; dynamodb-design.md, bảng orders): bảng orders, order-idempotency,
   * hàng đợi đơn có DLQ và Lambda ordering.
   * Quyền tối thiểu: orders GetItem, Query, PutItem, UpdateItem; order-idempotency như cart;
   * trên bảng của module khác chỉ các quyền ghi ở ADR-0017 (#226): products BatchGetItem và
   * UpdateItem (trừ, hoàn kho), carts GetItem và UpdateItem; chỉ gửi vào hàng đợi đơn.
   * Mọi route gắn JWT authorizer của Cognito.
   */
  private addOrdering(
    shopEnv: ShopEnvironment,
    removalPolicy: RemovalPolicy,
    httpApi: HttpApi,
    products: Table,
    carts: Table,
  ) {
    // Khoá userId + orderId (ULID). Cùng bảng có item bộ đếm `#OPEN` (BR-14) và item đánh dấu
    // `#KEY#<idempotencyKey>` (chống tạo đơn trùng khi lỗi sau commit); chỉ item đánh dấu có
    // `expiresAt` nên TTL không bao giờ xoá đơn thật.
    const orders = new Table(this, 'OrdersTable', {
      partitionKey: { name: 'userId', type: AttributeType.STRING },
      sortKey: { name: 'orderId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      // ADR-0012: orders bật point-in-time recovery (RPO ≤ 5 phút cho đơn hàng)
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: shopEnv.isProd,
      removalPolicy,
    });
    // Admin xem đơn theo trạng thái, mới nhất trước (Q3); item `#OPEN`, `#KEY#…` không có status nên không vào
    orders.addGlobalSecondaryIndex({
      indexName: ORDERS_BY_STATUS_INDEX,
      partitionKey: { name: 'status', type: AttributeType.STRING },
      sortKey: { name: 'orderId', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });
    // Chống tạo đơn hai lần (ADR-0017): schema Powertools Idempotency, khoá `id`, TTL `expiration`
    const orderIdempotency = new Table(this, 'OrderIdempotencyTable', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiration',
      removalPolicy: RemovalPolicy.DESTROY,
    });
    Validations.of(orderIdempotency).acknowledge({
      id: 'AwsSolutions::AwsSolutions-DDB3',
      reason:
        'Bản ghi chống tạo đơn hai lần chỉ sống 24 giờ; đơn đã ghi có item đánh dấu riêng trong bảng orders.',
    });

    // Hàng đợi đơn cho worker order-processor (ordering.md, luồng SQS); lỗi quá 3 lần thì vào DLQ
    const deadLetterQueue = new Queue(this, 'OrdersDeadLetterQueue', {
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      retentionPeriod: Duration.days(14),
    });
    Validations.of(deadLetterQueue).acknowledge({
      id: 'AwsSolutions-SQS3',
      reason: 'Đây chính là DLQ của hàng đợi đơn; DLQ không cần DLQ của riêng nó.',
    });
    const queue = new Queue(this, 'OrdersQueue', {
      encryption: QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
      // Gấp 6 lần timeout dự kiến của worker (10 giây) theo khuyến nghị cho Lambda đọc SQS
      visibilityTimeout: Duration.seconds(60),
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: 3 },
    });

    const fn = new NodejsFunction(this, 'OrderingFunction', {
      entry: path.join(API_SRC, 'modules', 'ordering', 'lambda.ts'),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 512,
      // Giao dịch đặt hàng tới 54 thao tác, có thử lại khi giỏ đổi version
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, 'OrderingLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy,
      }),
      environment: {
        ORDERS_TABLE: orders.tableName,
        ORDER_IDEMPOTENCY_TABLE: orderIdempotency.tableName,
        PRODUCTS_TABLE: products.tableName,
        CARTS_TABLE: carts.tableName,
        ORDERS_QUEUE_URL: queue.queueUrl,
        POWERTOOLS_SERVICE_NAME: 'ordering',
        // Metric OrderEnqueueFailed tách theo môi trường (chung tài khoản, ADR-0013); alarm ở monitoring.ts dùng cùng namespace
        POWERTOOLS_METRICS_NAMESPACE: shopEnv.stackPrefix,
        POWERTOOLS_LOG_LEVEL: shopEnv.isProd ? 'INFO' : 'DEBUG',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: API_BUNDLING,
    });
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:Query', 'dynamodb:PutItem', 'dynamodb:UpdateItem'],
        resources: [orders.tableArn],
      }),
    );
    // Các thao tác Powertools Idempotency cần, chỉ trên bảng idempotency của chính ordering
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'dynamodb:GetItem',
          'dynamodb:PutItem',
          'dynamodb:UpdateItem',
          'dynamodb:DeleteItem',
        ],
        resources: [orderIdempotency.tableArn],
      }),
    );
    // Ngoại lệ ADR-0017: đọc tên, giá, tồn kho, trạng thái để chụp vào đơn và kiểm lại (BR-03)
    fn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:BatchGetItem'], resources: [products.tableArn] }),
    );
    // Trừ, hoàn kho trong TransactWriteItems. Không có điều kiện dynamodb:Attributes (O7, ADR-0017):
    // điều kiện đó tính cả status, price trong ConditionExpression nên IAM chặn lệnh trừ kho.
    fn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:UpdateItem'], resources: [products.tableArn] }),
    );
    // Ngoại lệ ADR-0017: đọc giỏ rồi bỏ các món đã đặt, ghi có điều kiện version trong cùng giao dịch
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
        resources: [carts.tableArn],
      }),
    );
    queue.grantSendMessages(fn);

    Tags.of(orders).add('module', 'ordering');
    Tags.of(orderIdempotency).add('module', 'ordering');
    Tags.of(queue).add('module', 'ordering');
    Tags.of(deadLetterQueue).add('module', 'ordering');
    Tags.of(fn).add('module', 'ordering');
    Validations.of(fn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
      },
    );

    const integration = new HttpLambdaIntegration('OrderingIntegration', fn);
    httpApi.addRoutes({
      path: '/api/v1/orders',
      methods: [HttpMethod.GET, HttpMethod.POST],
      integration,
      authorizer: this.authorizer,
    });
    httpApi.addRoutes({
      path: '/api/v1/orders/{orderId}',
      methods: [HttpMethod.GET, HttpMethod.DELETE],
      integration,
      authorizer: this.authorizer,
    });

    new CfnOutput(this, 'OrdersTableName', { value: orders.tableName });
    new CfnOutput(this, 'OrdersQueueUrl', { value: queue.queueUrl });
    return { fn, orders, queue, deadLetterQueue };
  }

  /**
   * Module events: bảng events (khoá userIdHash + eventKey, TTL 90 ngày theo cột `ttl`) và Lambda events.
   * Quyền tối thiểu: chỉ PutItem trên bảng events; chỉ đọc đúng tham số khoá HMAC
   * `/shop/<env>/events/hmac-key` (SecureString An tạo bằng CLI, không nằm trong template, threat model E6).
   * Route gắn JWT authorizer của Cognito (nhóm chốt 17/10/2026).
   */
  private addEvents(shopEnv: ShopEnvironment, removalPolicy: RemovalPolicy, httpApi: HttpApi) {
    const events = new Table(this, 'EventsTable', {
      partitionKey: { name: 'userIdHash', type: AttributeType.STRING },
      sortKey: { name: 'eventKey', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      deletionProtection: shopEnv.isProd,
      removalPolicy,
    });
    Validations.of(events).acknowledge({
      id: 'AwsSolutions::AwsSolutions-DDB3',
      reason:
        'Theo ADR-0012 chỉ orders và products bật point-in-time recovery; sự kiện chỉ giữ 90 ngày để huấn luyện gợi ý.',
    });
    const hmacKeyParameter = `/shop/${shopEnv.name}/events/hmac-key`;

    const eventsFn = new NodejsFunction(this, 'EventsFunction', {
      entry: path.join(API_SRC, 'modules', 'events', 'lambda.ts'),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(5),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, 'EventsLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy,
      }),
      environment: {
        EVENTS_TABLE: events.tableName,
        HMAC_KEY_PARAMETER: hmacKeyParameter,
        POWERTOOLS_SERVICE_NAME: 'events',
        POWERTOOLS_LOG_LEVEL: shopEnv.isProd ? 'INFO' : 'DEBUG',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: API_BUNDLING,
    });
    eventsFn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:PutItem'], resources: [events.tableArn] }),
    );
    // SecureString mã hoá bằng khoá AWS quản lý aws/ssm: key policy đã cho dùng qua SSM, không cần kms:Decrypt
    eventsFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          this.formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: hmacKeyParameter.slice(1),
          }),
        ],
      }),
    );
    Tags.of(events).add('module', 'events');
    Tags.of(eventsFn).add('module', 'events');
    Validations.of(eventsFn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
      },
    );

    httpApi.addRoutes({
      path: '/api/v1/events',
      methods: [HttpMethod.POST],
      integration: new HttpLambdaIntegration('EventsIntegration', eventsFn),
      authorizer: this.authorizer,
    });

    new CfnOutput(this, 'EventsTableName', { value: events.tableName });
    return { eventsFn, events };
  }

  /**
   * Consumer `PURCHASE` của module events: Lambda riêng, đọc hàng đợi `order-confirmed` của events.
   * Quyền tối thiểu: PutItem trên bảng events (khoá suy ra từ orderId + productId, có điều kiện
   * không ghi đè, nên tin giao lại không thành lượt mua thứ hai); đọc đúng tham số khoá HMAC như
   * Lambda API (threat model E6); nhận, xoá tin trên đúng hàng đợi này (SqsEventSource tự cấp).
   * Tin lỗi được báo riêng từng tin (reportBatchItemFailures); sau 5 lần vào DLQ.
   */
  private addPurchaseConsumer(
    shopEnv: ShopEnvironment,
    removalPolicy: RemovalPolicy,
    events: Table,
    queue: Queue,
  ) {
    const hmacKeyParameter = `/shop/${shopEnv.name}/events/hmac-key`;
    const fn = new NodejsFunction(this, 'EventsPurchaseFunction', {
      entry: path.join(API_SRC, 'modules', 'events', 'purchaseLambda.ts'),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      // Hàng đợi để visibility timeout 30 giây, tức 6 lần timeout này (order-confirmed.ts)
      timeout: Duration.seconds(5),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, 'EventsPurchaseLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy,
      }),
      environment: {
        EVENTS_TABLE: events.tableName,
        HMAC_KEY_PARAMETER: hmacKeyParameter,
        POWERTOOLS_SERVICE_NAME: 'events-purchase',
        POWERTOOLS_LOG_LEVEL: shopEnv.isProd ? 'INFO' : 'DEBUG',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: API_BUNDLING,
    });
    fn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:PutItem'], resources: [events.tableArn] }),
    );
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          this.formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: hmacKeyParameter.slice(1),
          }),
        ],
      }),
    );
    fn.addEventSource(new SqsEventSource(queue, { batchSize: 10, reportBatchItemFailures: true }));
    Tags.of(fn).add('module', 'events');
    Validations.of(fn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
      },
    );
    return fn;
  }

  /**
   * Worker order-processor của module ordering (ordering.md, luồng SQS; code ở
   * services/api/src/modules/ordering/processorLambda.ts, #259): đọc hàng đợi đơn, xác nhận đơn
   * `PENDING → CONFIRMED`, gửi tin `order-confirmed`. Lambda riêng, quyền riêng, tách khỏi Lambda API.
   * Quyền tối thiểu: GetItem, UpdateItem trên orders; sns:Publish lên topic; đọc hàng đợi do event
   * source tự cấp. Không có sqs:SendMessage, không quyền trên products, carts. Email SES làm ở PR sau.
   */
  private addOrderProcessor(
    shopEnv: ShopEnvironment,
    removalPolicy: RemovalPolicy,
    orders: Table,
    queue: Queue,
    topic: Topic,
  ) {
    const fn = new NodejsFunction(this, 'OrderProcessorFunction', {
      entry: path.join(API_SRC, 'modules', 'ordering', 'processorLambda.ts'),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      // Hàng đợi đơn để visibility timeout 60 giây, tức 6 lần timeout này (addOrdering)
      timeout: Duration.seconds(10),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, 'OrderProcessorLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy,
      }),
      environment: {
        ORDERS_TABLE: orders.tableName,
        ORDER_CONFIRMED_TOPIC_ARN: topic.topicArn,
        POWERTOOLS_SERVICE_NAME: 'order-processor',
        POWERTOOLS_LOG_LEVEL: shopEnv.isProd ? 'INFO' : 'DEBUG',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: API_BUNDLING,
    });
    // Đọc lại đơn (threat model O9) và xác nhận có điều kiện. Không đặt điều kiện dynamodb:Attributes:
    // điều kiện đó tính cả thuộc tính trong ConditionExpression và chỉ thử được trên AWS (#253, #254)
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:UpdateItem'],
        resources: [orders.tableArn],
      }),
    );
    topic.grantPublish(fn);
    // Threat model E9: chỉ role worker được gửi tin lên topic. Allow trong topic policy không chặn được
    // principal cùng tài khoản đã có sns:Publish trong IAM policy, nên dùng Deny với mọi principal khác.
    // SNS giao tin vào hàng đợi events không phải sns:Publish nên không bị ảnh hưởng.
    topic.addToResourcePolicy(
      new PolicyStatement({
        effect: Effect.DENY,
        principals: [new AnyPrincipal()],
        actions: ['sns:Publish'],
        resources: [topic.topicArn],
        conditions: { ArnNotEquals: { 'aws:PrincipalArn': fn.role!.roleArn } },
      }),
    );
    // maxConcurrency 2 là mức thấp nhất AWS cho phép: giữ nhịp chậm cho SES sandbox (1 thư/giây) ở PR
    // email và không chiếm Lambda chạy cùng lúc của cả tài khoản
    fn.addEventSource(
      new SqsEventSource(queue, { batchSize: 5, reportBatchItemFailures: true, maxConcurrency: 2 }),
    );
    Tags.of(fn).add('module', 'ordering');
    Validations.of(fn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
      },
    );
    return fn;
  }

  /**
   * Module recommendation: Lambda API gợi ý, đọc bảng recs mà pipeline mỗi đêm ghi.
   * Quyền tối thiểu: GetItem (con trỏ), Query (dòng gợi ý) trên recs; đọc products CHỈ bằng
   * BatchGetItem trên ARN bảng, không gồm index (ADR-0017, sửa 24/10); chỉ đọc đúng tham số khoá HMAC
   * của events để băm userId giống events (threat model E6).
   * `also-bought`, `bestsellers` công khai; `for-you` gắn JWT authorizer của Cognito.
   */
  private addRecommendation(
    shopEnv: ShopEnvironment,
    removalPolicy: RemovalPolicy,
    httpApi: HttpApi,
    products: Table,
    recs: Table,
  ) {
    const hmacKeyParameter = `/shop/${shopEnv.name}/events/hmac-key`;
    const fn = new NodejsFunction(this, 'RecommendationFunction', {
      entry: path.join(API_SRC, 'modules', 'recommendation', 'lambda.ts'),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(5),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, 'RecommendationLogs', {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy,
      }),
      environment: {
        RECS_TABLE: recs.tableName,
        PRODUCTS_TABLE: products.tableName,
        HMAC_KEY_PARAMETER: hmacKeyParameter,
        POWERTOOLS_SERVICE_NAME: 'recommendation',
        POWERTOOLS_LOG_LEVEL: shopEnv.isProd ? 'INFO' : 'DEBUG',
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: API_BUNDLING,
    });
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:GetItem', 'dynamodb:Query'],
        resources: [recs.tableArn],
      }),
    );
    fn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:BatchGetItem'], resources: [products.tableArn] }),
    );
    // SecureString mã hoá bằng khoá AWS quản lý aws/ssm: key policy đã cho dùng qua SSM, không cần kms:Decrypt
    fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['ssm:GetParameter'],
        resources: [
          this.formatArn({
            service: 'ssm',
            resource: 'parameter',
            resourceName: hmacKeyParameter.slice(1),
          }),
        ],
      }),
    );
    Tags.of(fn).add('module', 'recommendation');
    Validations.of(fn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
      },
    );

    const integration = new HttpLambdaIntegration('RecommendationIntegration', fn);
    const publicRoutes = [
      ...httpApi.addRoutes({
        path: '/api/v1/recs/also-bought',
        methods: [HttpMethod.GET],
        integration,
      }),
      ...httpApi.addRoutes({
        path: '/api/v1/recs/bestsellers',
        methods: [HttpMethod.GET],
        integration,
      }),
    ];
    for (const route of publicRoutes) {
      Validations.of(route).acknowledge({
        id: 'AwsSolutions::AwsSolutions-APIG4',
        reason:
          'Gợi ý mua kèm và hàng bán chạy là công khai như xem sản phẩm; chỉ for-you cần đăng nhập (ADR-0007).',
      });
    }
    httpApi.addRoutes({
      path: '/api/v1/recs/for-you',
      methods: [HttpMethod.GET],
      integration,
      authorizer: this.authorizer,
    });
    return fn;
  }

  /** Lambda nhỏ không đọc dữ liệu (health, account): mặc định 128 MB, 3 giây; chỉ có quyền ghi log và X-Ray. */
  private noDataFunction(
    name: string,
    module: string,
    removalPolicy: RemovalPolicy,
    entryFile = 'lambda.ts',
    serviceName = module,
    sizing: { readonly memorySize?: number; readonly timeout?: Duration } = {},
  ) {
    const fn = new NodejsFunction(this, `${name}Function`, {
      entry: path.join(API_SRC, 'modules', module, entryFile),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: sizing.memorySize ?? 128,
      timeout: sizing.timeout ?? Duration.seconds(3),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, `${name}Logs`, {
        retention: RetentionDays.TWO_WEEKS,
        removalPolicy,
      }),
      environment: {
        POWERTOOLS_SERVICE_NAME: serviceName,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: API_BUNDLING,
    });
    Validations.of(fn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
      },
    );
    return fn;
  }

  /**
   * Cognito cho khách đăng nhập (ADR-0007): đăng nhập bằng email, tự đăng ký, MFA tuỳ chọn bằng app.
   * Web dùng luồng SRP nên mật khẩu không bao giờ gửi đi dạng rõ. Trả về JWT authorizer cho HTTP API.
   */
  private addCognito(shopEnv: ShopEnvironment, removalPolicy: RemovalPolicy) {
    const userPool = new UserPool(this, 'UserPool', {
      userPoolName: `${shopEnv.stackPrefix}-users`,
      // Lite đủ cho SRP, MFA TOTP; 10.000 người dùng hoạt động mỗi tháng đầu tiên miễn phí
      featurePlan: FeaturePlan.LITE,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: true } },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      mfa: Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      deletionProtection: shopEnv.isProd,
      removalPolicy,
    });
    // Username (preferred_username) bắt buộc, đúng luật và không trùng: kiểm trước khi tạo tài khoản
    const preSignUpFn = this.noDataFunction(
      'PreSignUp',
      'account',
      removalPolicy,
      'preSignUpLambda.ts',
      'account-signup',
      // Cognito chờ trigger tối đa 5 giây; 128 MB quá ít CPU, khởi động lạnh có lần quá 3 giây (staging 21/10)
      { memorySize: 512, timeout: Duration.seconds(5) },
    );
    // Không dùng userPool.userPoolArn: user pool đã trỏ tới Lambda này, trỏ ngược lại sẽ thành vòng
    preSignUpFn.addToRolePolicy(
      new PolicyStatement({
        actions: ['cognito-idp:ListUsers'],
        resources: [
          Stack.of(this).formatArn({
            service: 'cognito-idp',
            resource: 'userpool',
            resourceName: '*',
          }),
        ],
      }),
    );
    Validations.of(preSignUpFn).acknowledge({
      // Tên ghi nhận chứa region và account thật; CI synth khi chưa biết account nên dùng chữ thay thế
      id: `AwsSolutions-IAM5[Resource::arn:aws:cognito-idp:${this.region}:${Token.isUnresolved(this.account) ? '<AWS::AccountId>' : this.account}:userpool/*]`,
      reason:
        'Chỉ ListUsers (đọc) để kiểm trùng username; ghi ARN đúng user pool sẽ tạo phụ thuộc vòng với trigger.',
    });
    userPool.addTrigger(UserPoolOperation.PRE_SIGN_UP, preSignUpFn);

    const webClient = userPool.addClient('WebClient', {
      userPoolClientName: `${shopEnv.stackPrefix}-web`,
      authFlows: { userSrp: true },
      generateSecret: false,
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(30),
    });
    new CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
      description: 'Quản trị shop: thêm sản phẩm, xem đơn',
    });
    Validations.of(userPool).acknowledge(
      {
        id: 'AwsSolutions-COG2',
        reason:
          'MFA tuỳ chọn cho khách mua hàng để không cản việc đăng ký; trang admin sẽ bắt buộc nhóm admin bật MFA.',
      },
      {
        id: 'AwsSolutions-COG3',
        reason:
          'Threat protection (advanced security) cần gói Plus tính phí theo người dùng; ngoài ngân sách demo.',
      },
      {
        id: 'AwsSolutions::AwsSolutions-COG8',
        reason:
          'Gói Plus tính phí theo người dùng hoạt động; gói Lite đủ cho SRP và MFA của shop demo.',
      },
    );

    new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: webClient.userPoolClientId });

    // Client cho E2E (Newman) đăng nhập bằng USER_PASSWORD_AUTH (hands-on-testing-guide.md mục 6.3).
    // Chỉ ở dev và staging: prod không bao giờ có client nhận mật khẩu gửi thẳng.
    const clients = [webClient];
    if (!shopEnv.isProd) {
      const e2eClient = userPool.addClient('E2eClient', {
        userPoolClientName: `${shopEnv.stackPrefix}-e2e`,
        authFlows: { userPassword: true },
        generateSecret: false,
        preventUserExistenceErrors: true,
        enableTokenRevocation: true,
        accessTokenValidity: Duration.hours(1),
        idTokenValidity: Duration.hours(1),
        refreshTokenValidity: Duration.days(1),
      });
      clients.push(e2eClient);
      new CfnOutput(this, 'UserPoolE2eClientId', { value: e2eClient.userPoolClientId });
    }

    const authorizer = new HttpUserPoolAuthorizer('CognitoAuthorizer', userPool, {
      userPoolClients: clients,
    });
    return { userPool, webClient, authorizer, preSignUpFn };
  }

  /**
   * Nạp sản phẩm demo vào bảng products mỗi lần deploy mà products.json đổi (sandbox, dev, staging).
   * Không bao giờ có ở prod. Nhờ vậy dev có dữ liệu thật mà không ai phải chạy script bằng tay
   * hay cần quyền ghi bảng trên tài khoản demo.
   */
  private seedDemoProducts(
    products: Table,
    removalPolicy: RemovalPolicy,
    mode: 'overwrite' | 'insert-missing',
  ) {
    const seedFn = new NodejsFunction(this, 'SeedProductsFunction', {
      entry: path.join(API_SRC, 'modules', 'catalog', 'seedLambda.ts'),
      depsLockFilePath: path.join(REPO_ROOT, 'pnpm-lock.yaml'),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.minutes(2),
      logGroup: new LogGroup(this, 'SeedProductsLogs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy,
      }),
      environment: {
        PRODUCTS_TABLE: products.tableName,
        SEED_MODE: mode,
        NODE_OPTIONS: '--enable-source-maps',
      },
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        minify: true,
        sourceMap: true,
        mainFields: ['module', 'main'],
        banner:
          "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
        externalModules: [],
        // Đặt products.json cạnh code đã đóng gói; Lambda đọc file này lúc chạy
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (_inputDir: string, outputDir: string) => [
            // Chép bằng Node thay vì `cp` để chạy được cả trên Windows (cmd.exe không có cp)
            `node -e "require('fs').copyFileSync(process.argv[1], process.argv[2])" "${DEMO_PRODUCTS_FILE}" "${path.join(outputDir, 'products.json')}"`,
          ],
        },
      },
    });
    // Không đọc, không xoá. overwrite: chỉ ghi theo lô. insert-missing (prod): chỉ PutItem có điều kiện
    seedFn.addToRolePolicy(
      new PolicyStatement({
        actions: [mode === 'overwrite' ? 'dynamodb:BatchWriteItem' : 'dynamodb:PutItem'],
        resources: [products.tableArn],
      }),
    );

    const provider = new Provider(this, 'SeedProductsProvider', {
      onEventHandler: seedFn,
      logGroup: new LogGroup(this, 'SeedProductsProviderLogs', {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy,
      }),
    });
    const seed = new CustomResource(this, 'SeedProducts', {
      serviceToken: provider.serviceToken,
      // Đổi nội dung file thì mã băm đổi, CloudFormation gửi Update và Lambda nạp lại
      properties: {
        dataHash: createHash('sha256').update(readFileSync(DEMO_PRODUCTS_FILE)).digest('hex'),
      },
    });
    seed.node.addDependency(products);

    Tags.of(seedFn).add('module', 'catalog');
    Validations.of(provider).acknowledge({
      id: 'AwsSolutions-IAM5[Resource::<SeedProductsFunction9F24CE6C.Arn>:*]',
      reason:
        'Policy do Provider của CDK tự sinh: cho Lambda framework gọi Lambda nạp dữ liệu (kèm version).',
    });
    for (const construct of [seedFn, provider]) {
      Validations.of(construct).acknowledge({
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      });
    }
  }
}
