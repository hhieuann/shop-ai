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
    // Bỏ qua bước đóng gói cho test chạy nhanh; đóng gói thật do `cdk synth` kiểm.
    const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
    const stack = new ApiStack(app, 'TestApi', { shopEnv, env: { region: 'ap-southeast-1' } });
    templates.set(shopEnv.name, (template = Template.fromStack(stack)));
  }
  return template;
}

/** Các statement IAM của role Lambda pipeline */
function pipelineStatements(
  template: Template,
): { Action: unknown; Resource: unknown; Condition?: unknown }[] {
  const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
    JSON.stringify(p.Properties.Roles).includes('RecsPipelineFunctionServiceRole'),
  );
  return policies.flatMap((p) => p.Properties.PolicyDocument.Statement);
}

describe('ApiStack · recs pipeline', () => {
  it('pipelineFunction_isPython_withTablesAndSyntheticOnlyOutsideProd', () => {
    // Assert: dev, staging trộn dữ liệu giả lập, prod chỉ dùng sự kiện thật (nhóm chốt 22/10)
    for (const [shopEnv, synthetic] of [
      [staging, '1'],
      [prod, '0'],
    ] as const) {
      synth(shopEnv).hasResourceProperties('AWS::Lambda::Function', {
        Runtime: 'python3.14',
        Handler: 'data.pipeline.lambda_handler.handler',
        Timeout: 300,
        Environment: {
          Variables: {
            RECS_TABLE: { Ref: Match.stringLikeRegexp('^RecsTable') },
            PRODUCTS_TABLE: { Ref: Match.stringLikeRegexp('^ProductsTable') },
            EVENTS_TABLE: { Ref: Match.stringLikeRegexp('^EventsTable') },
            SYNTHETIC: synthetic,
            PRODUCTS_JSON: '/var/task/seed/products.json',
          },
        },
      });
    }
  });

  it('pipelineRole_hasOnlyTheFiveRecsActions_andScansProductsWithFourColumns', () => {
    // Act
    const statements = pipelineStatements(synth(staging));
    const dynamo = statements.filter((s) => JSON.stringify(s.Action).includes('dynamodb:'));
    const byTable = (prefix: string) =>
      dynamo.filter((s) => JSON.stringify(s.Resource).includes(`"${prefix}`));

    // Assert: ADR-0017; không DeleteItem, không Scan bảng recs, không ghi products, events
    expect(dynamo).toHaveLength(3);
    expect(byTable('RecsTable')[0]?.Action).toEqual([
      'dynamodb:BatchWriteItem',
      'dynamodb:PutItem',
      'dynamodb:GetItem',
      'dynamodb:Query',
      'dynamodb:UpdateItem',
    ]);
    expect(byTable('ProductsTable')[0]).toMatchObject({
      Action: 'dynamodb:Scan',
      Condition: {
        'ForAllValues:StringEquals': {
          'dynamodb:Attributes': ['productId', 'category', 'status', 'createdAt'],
        },
        StringEqualsIfExists: { 'dynamodb:Select': 'SPECIFIC_ATTRIBUTES' },
      },
    });
    expect(byTable('EventsTable')[0]?.Action).toBe('dynamodb:Scan');
    expect(JSON.stringify(statements)).not.toMatch(/ssm:|sqs:|sns:|s3:/);
  });

  it('nightlySchedule_runsAt2amVietnam_andRetriesTwice', () => {
    // Act + Assert
    synth(staging).hasResourceProperties('AWS::Scheduler::Schedule', {
      ScheduleExpression: 'cron(0 2 * * ? *)',
      ScheduleExpressionTimezone: 'Asia/Ho_Chi_Minh',
      Target: {
        Arn: { 'Fn::GetAtt': [Match.stringLikeRegexp('^RecsPipelineFunction'), 'Arn'] },
        RetryPolicy: { MaximumRetryAttempts: 2, MaximumEventAgeInSeconds: 3600 },
      },
    });
  });

  it('noSuccessAlarm_existsOnlyInProd_over26Hours', () => {
    // Act
    const name = { AlarmName: 'shop-prd-recs-pipeline-no-success' };
    const stagingAlarms = synth(staging).findResources('AWS::CloudWatch::Alarm', {
      Properties: { AlarmName: 'shop-stg-recs-pipeline-no-success' },
    });

    // Assert: hạn mức alarm miễn phí, chỉ prod (nhóm chốt 24/10); missing data tính là lỗi
    expect(Object.keys(stagingAlarms)).toHaveLength(0);
    synth(prod).hasResourceProperties('AWS::CloudWatch::Alarm', {
      ...name,
      ComparisonOperator: 'LessThanThreshold',
      Threshold: 1,
      EvaluationPeriods: 26,
      DatapointsToAlarm: 26,
      TreatMissingData: 'breaching',
      Metrics: Match.arrayWith([
        Match.objectLike({ Expression: 'FILL(invocations, 0) - FILL(errors, 0)' }),
      ]),
    });
  });
});
