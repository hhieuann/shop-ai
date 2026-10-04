import * as path from 'node:path';
import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  Tags,
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
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction, OutputFormat } from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const API_SRC = path.join(REPO_ROOT, 'services', 'api', 'src');

export interface ApiStackProps extends StackProps {
  readonly shopEnv: ShopEnvironment;
}

/** API của shop: bảng dữ liệu, Lambda theo từng module, HTTP API. Module mẫu: catalog. */
export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);
    const { shopEnv } = props;
    const removalPolicy = shopEnv.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY;

    // Theo docs/business/dynamodb-design.md: khoá chính `productId`. Hoàng thêm GSI byCategory khi làm
    // API danh sách. Giữ khớp với services/api/test/helpers/catalog.ts
    const products = new Table(this, 'ProductsTable', {
      partitionKey: { name: 'productId', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      deletionProtection: shopEnv.isProd,
      removalPolicy,
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
      bundling: {
        format: OutputFormat.ESM,
        target: 'node24',
        minify: true,
        sourceMap: true,
        mainFields: ['module', 'main'],
        // Thư viện CommonJS nằm trong bundle ESM vẫn cần `require`
        banner:
          "import { createRequire } from 'module';const require = createRequire(import.meta.url);",
        // Đóng gói AWS SDK cùng code để cố định phiên bản, không dựa vào bản có sẵn trong runtime
        externalModules: [],
      },
    });
    // Quyền tối thiểu: chỉ GetItem trên đúng bảng này. Cần Query cho danh sách thì thêm action ở đây.
    catalogFn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:GetItem'], resources: [products.tableArn] }),
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

    const httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `${shopEnv.stackPrefix}-api`,
      createDefaultStage: false,
    });
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

    const [getProductRoute] = httpApi.addRoutes({
      path: '/api/v1/products/{productId}',
      methods: [HttpMethod.GET],
      integration: new HttpLambdaIntegration('CatalogIntegration', catalogFn),
    });
    Validations.of(getProductRoute).acknowledge({
      id: 'AwsSolutions::AwsSolutions-APIG4',
      reason:
        'Xem sản phẩm là công khai. Route cần đăng nhập dùng JWT authorizer của Cognito (ADR-0007).',
    });

    new CfnOutput(this, 'ApiUrl', { value: httpApi.apiEndpoint });
    new CfnOutput(this, 'ProductsTableName', { value: products.tableName });
  }
}
