import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import type { ShopEnvironment } from '../lib/config.js';

const dev: ShopEnvironment = { name: 'dev', stackPrefix: 'shop-dev', isProd: false };
const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };

function synth(shopEnv: ShopEnvironment): Template {
  // Bỏ qua bước esbuild cho test chạy nhanh; đóng gói thật do `cdk synth` kiểm.
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const stack = new ApiStack(app, 'TestApi', { shopEnv, env: { region: 'ap-southeast-1' } });
  return Template.fromStack(stack);
}

describe('ApiStack', () => {
  it('productsTable_usesProductIdAsPartitionKeyWithOnDemandBilling', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [{ AttributeName: 'productId', KeyType: 'HASH' }],
      AttributeDefinitions: [{ AttributeName: 'productId', AttributeType: 'S' }],
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  it('productsTable_isDeletedWithStack_whenNotProd', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Delete',
      UpdateReplacePolicy: 'Delete',
    });
  });

  it('productsTable_isRetainedAndProtected_whenProd', () => {
    // Act
    const template = synth(prod);

    // Assert
    template.hasResource('AWS::DynamoDB::Table', {
      DeletionPolicy: 'Retain',
      UpdateReplacePolicy: 'Retain',
      Properties: Match.objectLike({ DeletionProtectionEnabled: true }),
    });
  });

  it('catalogFunction_runsNode24OnArmWithTableName', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      Environment: {
        Variables: Match.objectLike({
          PRODUCTS_TABLE: { Ref: Match.stringLikeRegexp('^ProductsTable') },
          POWERTOOLS_SERVICE_NAME: 'catalog',
        }),
      },
    });
  });

  it('catalogFunction_canOnlyGetItemFromProductsTable', () => {
    // Act
    const template = synth(dev);

    // Assert: quyền DynamoDB duy nhất là GetItem trên đúng bảng products, không Scan
    const statements = Object.values(template.findResources('AWS::IAM::Policy')).flatMap(
      (policy) => policy.Properties.PolicyDocument.Statement,
    );
    const dynamo = statements.filter((s) =>
      [s.Action].flat().some((action: string) => action.startsWith('dynamodb:')),
    );
    expect(dynamo).toHaveLength(1);
    expect(dynamo[0].Action).toBe('dynamodb:GetItem');
    expect(dynamo[0].Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^ProductsTable/), 'Arn'],
    });
  });

  it('httpApi_routesGetProductAndExposesUrl', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /api/v1/products/{productId}',
    });
    template.hasOutput('ApiUrl', Match.anyValue());
  });

  it('httpApiStage_hasAccessLogsAndThrottling', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasResourceProperties('AWS::ApiGatewayV2::Stage', {
      StageName: '$default',
      AccessLogSettings: Match.objectLike({ DestinationArn: Match.anyValue() }),
      DefaultRouteSettings: Match.objectLike({
        ThrottlingRateLimit: Match.anyValue(),
        ThrottlingBurstLimit: Match.anyValue(),
      }),
    });
  });
});
