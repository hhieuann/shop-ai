import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import type { ShopEnvironment } from '../lib/config.js';

const staging: ShopEnvironment = { name: 'staging', stackPrefix: 'shop-stg', isProd: false };

let template: Template | undefined;
function synth(): Template {
  if (!template) {
    // Bỏ qua bước esbuild cho test chạy nhanh; đóng gói thật do `cdk synth` kiểm.
    const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
    const stack = new ApiStack(app, 'TestApi', {
      shopEnv: staging,
      env: { region: 'ap-southeast-1' },
    });
    template = Template.fromStack(stack);
  }
  return template;
}

/** Các statement IAM của role Lambda recommendation */
function recsStatements(): { Action: unknown; Resource: unknown }[] {
  const policies = Object.values(synth().findResources('AWS::IAM::Policy')).filter((p) =>
    JSON.stringify(p.Properties.Roles).includes('RecommendationFunctionServiceRole'),
  );
  return policies.flatMap((p) => p.Properties.PolicyDocument.Statement);
}

describe('ApiStack · recommendation', () => {
  it('recsFunction_onlyReadsRecsProductsAndHmacKey', () => {
    // Act
    const statements = recsStatements();
    const dynamo = statements.filter((s) => JSON.stringify(s.Action).includes('dynamodb:'));
    const ssm = statements.filter((s) => JSON.stringify(s.Action).includes('ssm:'));

    // Assert: chỉ đọc; products chỉ BatchGetItem trên ARN bảng, không gồm index (ADR-0017)
    expect(dynamo).toEqual([
      {
        Effect: 'Allow',
        Action: ['dynamodb:GetItem', 'dynamodb:Query'],
        Resource: { 'Fn::GetAtt': [expect.stringMatching(/^RecsTable/), 'Arn'] },
      },
      {
        Effect: 'Allow',
        Action: 'dynamodb:BatchGetItem',
        Resource: { 'Fn::GetAtt': [expect.stringMatching(/^ProductsTable/), 'Arn'] },
      },
    ]);
    expect(ssm).toHaveLength(1);
    expect(ssm[0]?.Action).toBe('ssm:GetParameter');
    expect(JSON.stringify(ssm[0]?.Resource)).toContain(':parameter/shop/staging/events/hmac-key');
  });

  it('recsFunction_getsTableNamesAndParameterName', () => {
    // Assert
    synth().hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: Match.objectLike({
          RECS_TABLE: { Ref: Match.stringLikeRegexp('^RecsTable') },
          PRODUCTS_TABLE: { Ref: Match.stringLikeRegexp('^ProductsTable') },
          HMAC_KEY_PARAMETER: '/shop/staging/events/hmac-key',
          POWERTOOLS_SERVICE_NAME: 'recommendation',
        }),
      },
    });
  });

  it.each([
    ['GET /api/v1/recs/also-bought', 'NONE'],
    ['GET /api/v1/recs/bestsellers', 'NONE'],
    ['GET /api/v1/recs/for-you', 'JWT'],
  ])('route %s uses authorization %s', (routeKey, authorizationType) => {
    // Assert: chỉ for-you cần đăng nhập (contracts/openapi.yaml)
    synth().hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: routeKey,
      AuthorizationType: authorizationType,
    });
  });
});
