import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import type { ShopEnvironment } from '../lib/config.js';

const staging: ShopEnvironment = { name: 'staging', stackPrefix: 'shop-stg', isProd: false };
const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };

/** Địa chỉ gửi giả cho test, giống `-c senderEmail` mà deploy truyền từ secret (#261) */
const SENDER = 'shop@example.com';

const templates = new Map<string, Template>();
function synth(shopEnv: ShopEnvironment, senderEmail?: string): Template {
  const cacheKey = `${shopEnv.name}:${senderEmail ?? ''}`;
  let template = templates.get(cacheKey);
  if (!template) {
    // Bỏ qua bước esbuild cho test chạy nhanh; đóng gói thật do `cdk synth` kiểm.
    const app = new App({
      context: {
        'aws:cdk:bundling-stacks': [],
        ...(senderEmail === undefined ? {} : { senderEmail }),
      },
    });
    const stack = new ApiStack(app, 'TestApi', { shopEnv, env: { region: 'ap-southeast-1' } });
    templates.set(cacheKey, (template = Template.fromStack(stack)));
  }
  return template;
}

interface Statement {
  readonly Action: unknown;
  readonly Resource: unknown;
  readonly Condition?: unknown;
}

/** Các statement IAM của role Lambda ordering */
function orderingStatements(template: Template): Statement[] {
  const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
    JSON.stringify(p.Properties.Roles).includes('OrderingFunctionServiceRole'),
  );
  return policies.flatMap((p) => p.Properties.PolicyDocument.Statement as Statement[]);
}

/** Statement nào trỏ vào tài nguyên có logical id bắt đầu bằng `prefix` */
function on(statements: readonly Statement[], prefix: string): Statement[] {
  return statements.filter((s) => JSON.stringify(s.Resource).includes(`"${prefix}`));
}

function actions(statements: readonly Statement[]): string[] {
  return statements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action])).sort();
}

describe('ApiStack · ordering', () => {
  it('ordersTable_usesUserIdAndOrderId_withStatusIndexTtlAndPitr', () => {
    // Act
    const template = synth(staging);

    // Assert: dynamodb-design.md, bảng orders; TTL chỉ cho item đánh dấu #KEY#
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        { AttributeName: 'userId', KeyType: 'HASH' },
        { AttributeName: 'orderId', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
      PointInTimeRecoverySpecification: { PointInTimeRecoveryEnabled: true },
      GlobalSecondaryIndexes: [
        Match.objectLike({
          IndexName: 'byStatus',
          KeySchema: [
            { AttributeName: 'status', KeyType: 'HASH' },
            { AttributeName: 'orderId', KeyType: 'RANGE' },
          ],
        }),
      ],
    });
  });

  it('ordersTable_isRetainedWithDeletionProtection_inProd', () => {
    // Act
    const tables = synth(prod).findResources('AWS::DynamoDB::Table', {
      Properties: {
        KeySchema: Match.arrayWith([{ AttributeName: 'orderId', KeyType: 'RANGE' }]),
      },
    });

    // Assert
    const [table] = Object.values(tables);
    expect(table?.DeletionPolicy).toBe('Retain');
    expect(table?.Properties.DeletionProtectionEnabled).toBe(true);
  });

  it('ordersQueue_movesToDeadLetterQueue_afterThreeReceives', () => {
    // Act
    const template = synth(staging);

    // Assert: ordering.md, luồng SQS bước 4
    template.hasResourceProperties('AWS::SQS::Queue', {
      RedrivePolicy: {
        deadLetterTargetArn: {
          'Fn::GetAtt': [Match.stringLikeRegexp('^OrdersDeadLetterQueue'), 'Arn'],
        },
        maxReceiveCount: 3,
      },
      SqsManagedSseEnabled: true,
    });
  });

  it('orderingFunction_hasOnlyAgreedPermissions_onOtherModulesTables', () => {
    // Act
    const statements = orderingStatements(synth(staging));

    // Assert: ADR-0017 (#226) và threat model O7
    expect(actions(on(statements, 'OrdersTable'))).toEqual([
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:Query',
      'dynamodb:UpdateItem',
    ]);
    expect(actions(on(statements, 'ProductsTable'))).toEqual([
      'dynamodb:BatchGetItem',
      'dynamodb:UpdateItem',
    ]);
    expect(actions(on(statements, 'CartsTable'))).toEqual([
      'dynamodb:GetItem',
      'dynamodb:UpdateItem',
    ]);
    expect(JSON.stringify(statements)).not.toMatch(/Scan|BatchWriteItem|CartIdempotencyTable/);
  });

  it('orderingFunction_updatesProductsWithoutAttributeCondition', () => {
    // Act
    const statements = on(orderingStatements(synth(staging)), 'ProductsTable');

    // Assert: O7, không có điều kiện dynamodb:Attributes vì giao dịch trừ kho có điều kiện status, price (ADR-0017)
    const update = statements.find((s) => s.Action === 'dynamodb:UpdateItem');
    expect(update).toBeDefined();
    expect(update?.Condition).toBeUndefined();
  });

  it('orderingFunction_canOnlySendToOrdersQueue', () => {
    // Act
    const statements = orderingStatements(synth(staging));
    const sqs = statements.filter((s) => JSON.stringify(s.Action).includes('sqs:'));

    // Assert: chỉ gửi, chỉ vào hàng đợi đơn (threat model O9)
    expect(sqs).toHaveLength(1);
    expect(JSON.stringify(sqs[0]?.Action)).not.toMatch(/ReceiveMessage|DeleteMessage/);
    expect(sqs[0]?.Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^OrdersQueue/), 'Arn'],
    });
  });

  it('orderingRoutes_requireCognitoJwt', () => {
    // Act
    const template = synth(staging);

    // Assert
    for (const routeKey of [
      'GET /api/v1/orders',
      'POST /api/v1/orders',
      'GET /api/v1/orders/{orderId}',
      'DELETE /api/v1/orders/{orderId}',
    ]) {
      template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
        RouteKey: routeKey,
        AuthorizationType: 'JWT',
      });
    }
  });

  it('ordersDeadLetterAlarm_pointsToRunbook_inProd', () => {
    // Act
    const template = synth(prod);

    // Assert
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'shop-prd-orders-dlq',
      AlarmDescription: 'Xử lý theo docs/runbooks/dlq-orders.md',
      Threshold: 1,
    });
  });

  it('ordersDeadLetterAlarm_isNotCreated_outsideProd', () => {
    // Act
    const alarms = synth(staging).findResources('AWS::CloudWatch::Alarm', {
      Properties: { AlarmName: 'shop-stg-orders-dlq' },
    });

    // Assert: alarm mới chỉ ở prod, giữ dưới 10 alarm miễn phí của tài khoản chung (#235)
    expect(Object.keys(alarms)).toHaveLength(0);
  });

  it('orderEnqueueFailedAlarm_watchesOrderingMetric_onlyInProd', () => {
    // Act
    const prodTemplate = synth(prod);
    const stagingAlarms = synth(staging).findResources('AWS::CloudWatch::Alarm', {
      Properties: { AlarmName: 'shop-stg-order-enqueue-failed' },
    });

    // Assert: metric Powertools của Lambda ordering, namespace theo môi trường (#244)
    prodTemplate.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'shop-prd-order-enqueue-failed',
      Namespace: 'shop-prd',
      MetricName: 'OrderEnqueueFailed',
      Dimensions: [{ Name: 'service', Value: 'ordering' }],
      AlarmDescription: 'Xử lý theo docs/runbooks/dlq-orders.md',
    });
    expect(Object.keys(stagingAlarms)).toHaveLength(0);
  });

  it('orderingFunction_writesMetricsToEnvironmentNamespace', () => {
    // Act
    const template = synth(staging);

    // Assert
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          POWERTOOLS_SERVICE_NAME: 'ordering',
          POWERTOOLS_METRICS_NAMESPACE: 'shop-stg',
        }),
      },
    });
  });
});

/** Các statement IAM của role Lambda worker order-processor */
function workerStatements(template: Template): Statement[] {
  const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
    JSON.stringify(p.Properties.Roles).includes('OrderProcessorFunctionServiceRole'),
  );
  return policies.flatMap((p) => p.Properties.PolicyDocument.Statement as Statement[]);
}

/** Logical id của role worker, để so với điều kiện trong topic policy */
function workerRoleId(template: Template): string {
  const [id] = Object.keys(template.findResources('AWS::IAM::Role')).filter((key) =>
    key.startsWith('OrderProcessorFunctionServiceRole'),
  );
  if (!id) throw new Error('Không thấy role của worker order-processor');
  return id;
}

describe('ApiStack · worker order-processor', () => {
  it('worker_readsOrdersQueue_withPartialBatchFailures_andTwoConcurrent', () => {
    // Act
    const template = synth(staging);

    // Assert: ordering.md luồng SQS; tin lỗi giao lại riêng từng tin, quá 3 lần vào DLQ có sẵn
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      FunctionName: { Ref: Match.stringLikeRegexp('^OrderProcessorFunction') },
      EventSourceArn: { 'Fn::GetAtt': [Match.stringLikeRegexp('^OrdersQueue'), 'Arn'] },
      BatchSize: 5,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
      ScalingConfig: { MaximumConcurrency: 2 },
    });
  });

  it('worker_runsWorkerEntry_withTableAndTopicFromStack', () => {
    // Act
    const template = synth(staging);

    // Assert: tên bảng, ARN topic lấy từ tài nguyên của stack, không ghi cứng
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 256,
      Timeout: 10,
      Architectures: ['arm64'],
      Environment: {
        Variables: Match.objectLike({
          ORDERS_TABLE: { Ref: Match.stringLikeRegexp('^OrdersTable') },
          ORDER_CONFIRMED_TOPIC_ARN: { Ref: Match.stringLikeRegexp('^OrderConfirmedTopic') },
          POWERTOOLS_SERVICE_NAME: 'order-processor',
        }),
      },
    });
  });

  it('worker_withoutSenderEmail_canOnlyReadAndUpdateOrders_andPublishOrderConfirmed', () => {
    // Act: máy local, CI của PR không truyền -c senderEmail
    const statements = workerStatements(synth(staging));
    const dynamo = statements.filter((s) => JSON.stringify(s.Action).includes('dynamodb:'));
    const sns = statements.filter((s) => JSON.stringify(s.Action).includes('sns:'));

    // Assert: chỉ bảng orders, không đặt điều kiện dynamodb:Attributes (#253, #254)
    expect(dynamo).toHaveLength(1);
    expect(dynamo[0]?.Action).toEqual(['dynamodb:GetItem', 'dynamodb:UpdateItem']);
    expect(dynamo[0]?.Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^OrdersTable/), 'Arn'],
    });
    expect(dynamo[0]?.Condition).toBeUndefined();
    expect(sns).toHaveLength(1);
    expect(sns[0]?.Action).toBe('sns:Publish');
    expect(sns[0]?.Resource).toEqual({ Ref: expect.stringMatching(/^OrderConfirmedTopic/) });

    // Verify: không gửi được vào hàng đợi, không đụng products, carts, idempotency, SES, Cognito
    const all = JSON.stringify(statements);
    expect(all).not.toContain('sqs:SendMessage');
    for (const forbidden of [
      'ProductsTable',
      'CartsTable',
      'Idempotency',
      'ses:',
      'cognito-idp:',
    ]) {
      expect(all).not.toContain(forbidden);
    }
  });

  it('worker_withoutSenderEmail_skipsEmailStep', () => {
    // Act
    const template = synth(staging);

    // Assert: thiếu biến thì worker bỏ bước thư (emailConfig.ts); metric vẫn theo môi trường
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          POWERTOOLS_SERVICE_NAME: 'order-processor',
          POWERTOOLS_METRICS_NAMESPACE: 'shop-stg',
          USER_POOL_ID: Match.absent(),
          ORDER_IDEMPOTENCY_TABLE: Match.absent(),
          SENDER_EMAIL: Match.absent(),
        }),
      },
    });
  });

  it('worker_withSenderEmail_getsEmailVariablesFromStack', () => {
    // Act
    const template = synth(staging, SENDER);

    // Assert: đủ 3 biến thì worker bật bước thư (emailConfig.ts); user pool, bảng lấy từ stack
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          POWERTOOLS_SERVICE_NAME: 'order-processor',
          POWERTOOLS_METRICS_NAMESPACE: 'shop-stg',
          USER_POOL_ID: { Ref: Match.stringLikeRegexp('^UserPool') },
          ORDER_IDEMPOTENCY_TABLE: { Ref: Match.stringLikeRegexp('^OrderIdempotencyTable') },
          SENDER_EMAIL: SENDER,
        }),
      },
    });
  });

  it('worker_withSenderEmail_sendsOnlyFromSender_andReadsOwnUserPoolAndIdempotency', () => {
    // Act
    const statements = workerStatements(synth(staging, SENDER));
    const ses = statements.filter((s) => JSON.stringify(s.Action).includes('ses:'));
    const cognito = statements.filter((s) => JSON.stringify(s.Action).includes('cognito-idp:'));
    const idempotency = on(statements, 'OrderIdempotencyTable');

    // Assert: sandbox kiểm quyền cả địa chỉ nhận nên resource là identity/*, điều kiện khoá
    // địa chỉ gửi
    expect(ses).toHaveLength(1);
    expect(ses[0]?.Action).toBe('ses:SendEmail');
    expect(JSON.stringify(ses[0]?.Resource)).toContain(':identity/*');
    expect(ses[0]?.Condition).toEqual({ StringEquals: { 'ses:FromAddress': SENDER } });
    // An chốt 25/10: chỉ ListUsers, chỉ trên user pool của môi trường này
    expect(cognito).toHaveLength(1);
    expect(cognito[0]?.Action).toBe('cognito-idp:ListUsers');
    expect(cognito[0]?.Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^UserPool/), 'Arn'],
    });
    // Powertools Idempotency chống gửi thư trùng, chỉ trên bảng order-idempotency
    expect(actions(idempotency)).toEqual([
      'dynamodb:DeleteItem',
      'dynamodb:GetItem',
      'dynamodb:PutItem',
      'dynamodb:UpdateItem',
    ]);

    // Verify: vẫn không gửi được vào hàng đợi, không đụng products, carts, cart-idempotency
    const all = JSON.stringify(statements);
    for (const forbidden of [
      'sqs:SendMessage',
      'ses:SendRawEmail',
      'ProductsTable',
      'CartsTable',
      'CartIdempotencyTable',
    ]) {
      expect(all).not.toContain(forbidden);
    }
  });

  it('orderConfirmedTopic_deniesPublish_fromAnyoneButWorkerRole', () => {
    // Act
    const template = synth(staging);
    const roleId = workerRoleId(template);

    // Assert: threat model E9; Deny vì Allow không chặn được principal cùng tài khoản
    template.hasResourceProperties('AWS::SNS::TopicPolicy', {
      Topics: [{ Ref: Match.stringLikeRegexp('^OrderConfirmedTopic') }],
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Principal: { AWS: '*' },
            Action: 'sns:Publish',
            Condition: { ArnNotEquals: { 'aws:PrincipalArn': { 'Fn::GetAtt': [roleId, 'Arn'] } } },
          }),
        ]),
      },
    });
  });

  it('worker_existsInProd_withSameLimits', () => {
    // Act
    const template = synth(prod);

    // Assert: prod cũng xác nhận đơn tự động, cùng giới hạn chạy cùng lúc
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      FunctionName: { Ref: Match.stringLikeRegexp('^OrderProcessorFunction') },
      ScalingConfig: { MaximumConcurrency: 2 },
    });
  });
});
