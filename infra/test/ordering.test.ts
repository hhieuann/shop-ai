import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import type { ShopEnvironment } from '../lib/config.js';

const staging: ShopEnvironment = { name: 'staging', stackPrefix: 'shop-stg', isProd: false };
const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };

const templates = new Map<string, Template>();
function synth(shopEnv: ShopEnvironment): Template {
  let template = templates.get(shopEnv.name);
  if (!template) {
    // Bỏ qua bước esbuild cho test chạy nhanh; đóng gói thật do `cdk synth` kiểm.
    const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
    const stack = new ApiStack(app, 'TestApi', { shopEnv, env: { region: 'ap-southeast-1' } });
    templates.set(shopEnv.name, (template = Template.fromStack(stack)));
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

  it('orderingFunction_canUpdateOnlyStockOfProducts', () => {
    // Act
    const statements = on(orderingStatements(synth(staging)), 'ProductsTable');

    // Assert: O7, UpdateItem trên products có điều kiện chỉ productId và stock
    const update = statements.find((s) => s.Action === 'dynamodb:UpdateItem');
    expect(update?.Condition).toEqual({
      'ForAllValues:StringEquals': { 'dynamodb:Attributes': ['productId', 'stock'] },
    });
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
});
