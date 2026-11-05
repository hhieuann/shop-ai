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

/** Các statement IAM của role Lambda events */
function eventsStatements(template: Template): { Action: unknown; Resource: unknown }[] {
  const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
    JSON.stringify(p.Properties.Roles).includes('EventsFunctionServiceRole'),
  );
  return policies.flatMap((p) => p.Properties.PolicyDocument.Statement);
}

describe('ApiStack · events', () => {
  it('eventsTable_usesUserIdHashAndEventKey_withTtl', () => {
    // Act
    const template = synth(staging);

    // Assert: dynamodb-design.md, bảng events; TTL 90 ngày theo cột ttl
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        { AttributeName: 'userIdHash', KeyType: 'HASH' },
        { AttributeName: 'eventKey', KeyType: 'RANGE' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    });
  });

  it('eventsTable_isRetainedWithDeletionProtection_inProd', () => {
    // Act
    const tables = synth(prod).findResources('AWS::DynamoDB::Table', {
      Properties: {
        KeySchema: Match.arrayWith([{ AttributeName: 'userIdHash', KeyType: 'HASH' }]),
      },
    });

    // Assert
    const [table] = Object.values(tables);
    expect(table?.DeletionPolicy).toBe('Retain');
    expect(table?.Properties.DeletionProtectionEnabled).toBe(true);
  });

  it('eventsFunction_canOnlyPutItemOnEventsTable_andReadOnlyItsHmacKey', () => {
    // Act
    const statements = eventsStatements(synth(staging));
    const dynamo = statements.filter((s) => JSON.stringify(s.Action).includes('dynamodb:'));
    const ssm = statements.filter((s) => JSON.stringify(s.Action).includes('ssm:'));

    // Assert: không đọc bảng nào, không đọc tham số SSM nào khác (threat model E6, E8)
    expect(dynamo).toHaveLength(1);
    expect(dynamo[0]?.Action).toBe('dynamodb:PutItem');
    expect(dynamo[0]?.Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^EventsTable/), 'Arn'],
    });
    expect(ssm).toHaveLength(1);
    expect(ssm[0]?.Action).toBe('ssm:GetParameter');
    expect(JSON.stringify(ssm[0]?.Resource)).toContain(':parameter/shop/staging/events/hmac-key');
    expect(JSON.stringify(statements)).not.toContain('kms:');
  });

  it('eventsFunction_getsTableAndParameterName_notTheKey', () => {
    // Act
    const template = synth(staging);

    // Assert: chỉ tên tham số nằm trong template, khoá thì Lambda đọc lúc chạy
    template.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          EVENTS_TABLE: { Ref: Match.stringLikeRegexp('^EventsTable') },
          HMAC_KEY_PARAMETER: '/shop/staging/events/hmac-key',
          POWERTOOLS_SERVICE_NAME: 'events',
        }),
      },
    });
  });

  it('eventsRoute_requiresCognitoJwt', () => {
    // Act
    const template = synth(staging);

    // Assert: nhóm chốt 17/10, ghi sự kiện bắt buộc đăng nhập
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'POST /api/v1/events',
      AuthorizationType: 'JWT',
    });
  });
});

/** Các statement IAM của role Lambda nhận PURCHASE */
function purchaseStatements(template: Template): { Action: unknown; Resource: unknown }[] {
  const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
    JSON.stringify(p.Properties.Roles).includes('EventsPurchaseFunctionServiceRole'),
  );
  return policies.flatMap((p) => p.Properties.PolicyDocument.Statement);
}

describe('ApiStack · events PURCHASE consumer', () => {
  it('purchaseFunction_readsEventsQueue_withPartialBatchFailures', () => {
    // Act
    const template = synth(staging);

    // Assert: events.md mục 1; tin lỗi giao lại riêng từng tin, sau 5 lần vào DLQ
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      FunctionName: { Ref: Match.stringLikeRegexp('^EventsPurchaseFunction') },
      EventSourceArn: {
        'Fn::GetAtt': [Match.stringLikeRegexp('^OrderConfirmedEventsQueue'), 'Arn'],
      },
      BatchSize: 10,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
    });
  });

  it('purchaseFunction_timeoutFitsQueueVisibilityTimeout', () => {
    // Act
    const template = synth(staging);

    // Assert: visibility 30 giây của hàng đợi = 6 lần timeout 5 giây
    template.hasResourceProperties('AWS::Lambda::Function', {
      Timeout: 5,
      Environment: {
        Variables: Match.objectLike({
          EVENTS_TABLE: { Ref: Match.stringLikeRegexp('^EventsTable') },
          HMAC_KEY_PARAMETER: '/shop/staging/events/hmac-key',
          POWERTOOLS_SERVICE_NAME: 'events-purchase',
        }),
      },
    });
  });

  it('purchaseFunction_canOnlyPutItemOnEventsTable_readItsHmacKey_andConsumeItsQueue', () => {
    // Act
    const statements = purchaseStatements(synth(staging));
    const dynamo = statements.filter((s) => JSON.stringify(s.Action).includes('dynamodb:'));
    const ssm = statements.filter((s) => JSON.stringify(s.Action).includes('ssm:'));
    const sqs = statements.filter((s) => JSON.stringify(s.Action).includes('sqs:'));

    // Assert: không đọc bảng nào, không gửi tin, không đọc tham số khác (threat model E6, E9)
    expect(dynamo).toHaveLength(1);
    expect(dynamo[0]?.Action).toBe('dynamodb:PutItem');
    expect(dynamo[0]?.Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^EventsTable/), 'Arn'],
    });
    expect(ssm).toHaveLength(1);
    expect(JSON.stringify(ssm[0]?.Resource)).toContain(':parameter/shop/staging/events/hmac-key');
    expect(sqs).toHaveLength(1);
    expect(JSON.stringify(sqs[0]?.Action)).not.toContain('sqs:SendMessage');
    expect(sqs[0]?.Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^OrderConfirmedEventsQueue/), 'Arn'],
    });
    expect(JSON.stringify(statements)).not.toContain('sns:');
  });
});
