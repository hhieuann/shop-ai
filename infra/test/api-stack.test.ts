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
      // productId cho khoá chính, categoryStatus cho GSI byCategory
      AttributeDefinitions: Match.arrayWith([{ AttributeName: 'productId', AttributeType: 'S' }]),
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

  it('productsTable_hasByCategoryIndexForListing', () => {
    // Act
    const template = synth(dev);

    // Assert: GSI theo "<category>#<status>", sort key productId, chiếu đủ thuộc tính
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      GlobalSecondaryIndexes: [
        {
          IndexName: 'byCategory',
          KeySchema: [
            { AttributeName: 'categoryStatus', KeyType: 'HASH' },
            { AttributeName: 'productId', KeyType: 'RANGE' },
          ],
          Projection: { ProjectionType: 'ALL' },
        },
      ],
    });
  });

  it('catalogFunction_canOnlyGetItemOnTableAndQueryOnCategoryIndex', () => {
    // Act
    const template = synth(dev);

    // Assert: chỉ 2 quyền DynamoDB, đúng chỗ; không Scan, không ghi.
    // Chỉ xét policy gắn vào role của CatalogFunction (Lambda nạp dữ liệu demo có quyền riêng)
    const statements = Object.values(template.findResources('AWS::IAM::Policy'))
      .filter((policy) =>
        JSON.stringify(policy.Properties.Roles).includes('CatalogFunctionServiceRole'),
      )
      .flatMap((policy) => policy.Properties.PolicyDocument.Statement);
    const dynamo = statements.filter((s) =>
      [s.Action].flat().some((action: string) => action.startsWith('dynamodb:')),
    );
    expect(dynamo.map((s) => s.Action).sort()).toEqual(['dynamodb:GetItem', 'dynamodb:Query']);

    const getItem = dynamo.find((s) => s.Action === 'dynamodb:GetItem');
    expect(getItem.Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^ProductsTable/), 'Arn'],
    });

    const query = dynamo.find((s) => s.Action === 'dynamodb:Query');
    expect(query.Resource).toEqual({
      'Fn::Join': [
        '',
        [{ 'Fn::GetAtt': [expect.stringMatching(/^ProductsTable/), 'Arn'] }, '/index/byCategory'],
      ],
    });
  });

  it('httpApi_routesListAndGetProductAndExposesUrl', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /api/v1/products',
    });
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

  it('demoProducts_areSeededOnDeploy_whenNotProd', () => {
    // Act
    const template = synth(dev);

    // Assert: custom resource nạp dữ liệu, chạy lại khi products.json đổi (dataHash)
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 1);
    template.hasResourceProperties('AWS::CloudFormation::CustomResource', {
      dataHash: Match.stringLikeRegexp('^[0-9a-f]{64}$'),
    });
    // Lambda nạp dữ liệu chỉ được BatchWriteItem vào bảng products
    template.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Action: 'dynamodb:BatchWriteItem', Effect: 'Allow' }),
        ]),
      },
    });
  });

  it('demoProducts_areNeverSeeded_whenProd', () => {
    // Act
    const template = synth(prod);

    // Assert
    template.resourceCountIs('AWS::CloudFormation::CustomResource', 0);
    expect(JSON.stringify(template.toJSON())).not.toContain('dynamodb:BatchWriteItem');
  });

  it('httpApi_routesHealthToDedicatedFunctionWithoutDataAccess', () => {
    // Act
    const template = synth(dev);

    // Assert: có route health
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', { RouteKey: 'GET /api/v1/health' });

    // Assert: Lambda health không có quyền DynamoDB nào, chỉ ghi log và X-Ray
    const fns = template.findResources('AWS::Lambda::Function', {
      Properties: { Environment: { Variables: { POWERTOOLS_SERVICE_NAME: 'health' } } },
    });
    expect(Object.keys(fns)).toHaveLength(1);
    const policies = Object.values(template.findResources('AWS::IAM::Policy')) as {
      Properties: {
        Roles: { Ref: string }[];
        PolicyDocument: { Statement: { Action: string | string[] }[] };
      };
    }[];
    const roleRef = (Object.values(fns)[0] as { Properties: { Role: { 'Fn::GetAtt': string[] } } })
      .Properties.Role['Fn::GetAtt'][0];
    const actions = policies
      .filter((p) => p.Properties.Roles.some((r) => r.Ref === roleRef))
      .flatMap((p) => p.Properties.PolicyDocument.Statement.flatMap((st) => st.Action));
    expect(actions.filter((a) => a.startsWith('dynamodb:'))).toEqual([]);
  });

  it('userPool_signsInWithEmailAndAllowsOptionalTotpMfa', () => {
    // Act
    const template = synth(dev);

    // Assert: khách tự đăng ký bằng email, xác minh email, MFA tuỳ chọn bằng app (không SMS)
    template.hasResourceProperties('AWS::Cognito::UserPool', {
      UsernameAttributes: ['email'],
      AutoVerifiedAttributes: ['email'],
      AdminCreateUserConfig: { AllowAdminCreateUserOnly: false },
      MfaConfiguration: 'OPTIONAL',
      EnabledMfas: ['SOFTWARE_TOKEN_MFA'],
    });
    template.hasResourceProperties('AWS::Cognito::UserPoolGroup', { GroupName: 'admin' });
  });

  it('webClient_usesSrpWithoutSecretAndHidesExistingUsers', () => {
    // Act
    const template = synth(dev);

    // Assert: web là ứng dụng công khai, không giữ được secret; chỉ SRP và refresh token
    template.hasResourceProperties('AWS::Cognito::UserPoolClient', {
      GenerateSecret: false,
      ExplicitAuthFlows: ['ALLOW_USER_SRP_AUTH', 'ALLOW_REFRESH_TOKEN_AUTH'],
      PreventUserExistenceErrors: 'ENABLED',
      EnableTokenRevocation: true,
    });
  });

  it('meRoute_requiresCognitoJwt_whileProductRoutesStayPublic', () => {
    // Act
    const template = synth(dev);

    // Assert: authorizer kiểu JWT trỏ tới user pool
    template.hasResourceProperties('AWS::ApiGatewayV2::Authorizer', {
      AuthorizerType: 'JWT',
      IdentitySource: ['$request.header.Authorization'],
    });
    template.hasResourceProperties('AWS::ApiGatewayV2::Route', {
      RouteKey: 'GET /api/v1/me',
      AuthorizationType: 'JWT',
    });
    for (const key of ['GET /api/v1/products', 'GET /api/v1/health']) {
      const routes = template.findResources('AWS::ApiGatewayV2::Route', {
        Properties: { RouteKey: key },
      });
      const route = Object.values(routes)[0] as { Properties: { AuthorizationType?: string } };
      expect(route.Properties.AuthorizationType ?? 'NONE').toBe('NONE');
    }
    template.hasOutput('UserPoolId', {});
    template.hasOutput('UserPoolClientId', {});
  });
});
