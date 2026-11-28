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

/** Các statement IAM của role Lambda có logical id bắt đầu bằng `functionId` */
function statementsOf(template: Template, functionId: string): Statement[] {
  const policies = Object.values(template.findResources('AWS::IAM::Policy')).filter((p) =>
    (p.Properties.Roles as { Ref: string }[]).some((r) =>
      r.Ref.startsWith(`${functionId}ServiceRole`),
    ),
  );
  return policies.flatMap((p) => p.Properties.PolicyDocument.Statement as Statement[]);
}

function dynamoStatements(statements: readonly Statement[]): Statement[] {
  return statements.filter((s) => JSON.stringify(s.Action).includes('dynamodb:'));
}

describe('ApiStack · API admin sản phẩm (catalog.md BR-09 … BR-15, #546)', () => {
  it('catalogAdminFunction_runsAdminEntry_withProductsTableEnv', () => {
    // Act
    const template = synth(staging);

    // Assert
    template.hasResourceProperties('AWS::Lambda::Function', {
      MemorySize: 256,
      Timeout: 10,
      Architectures: ['arm64'],
      TracingConfig: { Mode: 'Active' },
      Environment: {
        Variables: Match.objectLike({
          PRODUCTS_TABLE: { Ref: Match.stringLikeRegexp('^ProductsTable') },
          POWERTOOLS_SERVICE_NAME: 'catalog',
          ORDERS_TABLE: Match.absent(),
          CARTS_TABLE: Match.absent(),
        }),
      },
      LoggingConfig: { LogGroup: { Ref: Match.stringLikeRegexp('^CatalogAdminLogs') } },
      Tags: Match.arrayWith([{ Key: 'module', Value: 'catalog' }]),
    });
  });

  it('catalogAdminFunction_hasLeastPrivilege_onProductsOnly', () => {
    // Act
    const statements = statementsOf(synth(staging), 'CatalogAdminFunction');
    const dynamo = dynamoStatements(statements);

    // Assert: GetItem, PutItem, UpdateItem trên bảng; Query chỉ trên index byCategory
    expect(dynamo).toHaveLength(2);
    const write = dynamo.find((s) => Array.isArray(s.Action));
    expect(write?.Action).toEqual(['dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:UpdateItem']);
    expect(write?.Resource).toEqual({
      'Fn::GetAtt': [expect.stringMatching(/^ProductsTable/), 'Arn'],
    });
    const query = dynamo.find((s) => s.Action === 'dynamodb:Query');
    expect(JSON.stringify(query?.Resource)).toMatch(/ProductsTable.*\/index\/byCategory/);
    // Không điều kiện dynamodb:Attributes (#253, #254)
    for (const s of dynamo) expect(s.Condition).toBeUndefined();

    // Verify: không xoá hẳn (BR-14 xoá mềm), không quét, không bảng khác, không hàng đợi, không SNS
    const all = JSON.stringify(statements);
    for (const forbidden of [
      'dynamodb:DeleteItem',
      'dynamodb:Scan',
      'dynamodb:BatchWriteItem',
      'dynamodb:BatchGetItem',
      'OrdersTable',
      'CartsTable',
      'EventsTable',
      'Idempotency',
      'sqs:',
      'sns:',
      'kms:',
    ]) {
      expect(all).not.toContain(forbidden);
    }
  });

  it('catalogAdminRoutes_requireCognitoJwt_andPointToAdminIntegration', () => {
    // Act
    const routes = Object.values(synth(staging).findResources('AWS::ApiGatewayV2::Route'));

    // Assert: không token thì authorizer trả 401 trước khi tới Lambda
    const routeKeys = [
      'GET /api/v1/admin/products',
      'POST /api/v1/admin/products',
      'GET /api/v1/admin/products/{productId}',
      'PATCH /api/v1/admin/products/{productId}',
      'DELETE /api/v1/admin/products/{productId}',
      'POST /api/v1/admin/products/{productId}/restore',
    ];
    for (const routeKey of routeKeys) {
      const route = routes.find((r) => r.Properties.RouteKey === routeKey);
      expect(route?.Properties.AuthorizationType, routeKey).toBe('JWT');
      expect(JSON.stringify(route?.Properties.Target), routeKey).toContain(
        'CatalogAdminIntegration',
      );
    }
    // Verify: chỉ đúng 6 route này trỏ vào Lambda admin sản phẩm
    const adminProductRoutes = routes.filter((r) =>
      JSON.stringify(r.Properties.Target).includes('CatalogAdminIntegration'),
    );
    expect(adminProductRoutes.map((r) => r.Properties.RouteKey).sort()).toEqual(
      [...routeKeys].sort(),
    );
  });

  it('publicCatalogFunction_keepsReadOnlyPermissions', () => {
    // Act
    const dynamo = dynamoStatements(statementsOf(synth(staging), 'CatalogFunction'));

    // Assert: Lambda catalog công khai vẫn chỉ GetItem bảng và Query index (không ghi)
    expect(dynamo.map((s) => s.Action).sort()).toEqual(['dynamodb:GetItem', 'dynamodb:Query']);
    expect(JSON.stringify(dynamo)).not.toMatch(/PutItem|UpdateItem|DeleteItem|Scan/);
  });

  it('dashboard_showsCatalogAdminErrorsAndDuration', () => {
    // Act
    const dashboards = Object.values(synth(staging).findResources('AWS::CloudWatch::Dashboard'));
    const body = JSON.stringify(dashboards[0]?.Properties.DashboardBody);

    // Assert: đường catalog-admin trong biểu đồ lỗi và thời gian chạy (không thêm alarm)
    expect(body.match(/catalog-admin/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('catalogAdminFunction_existsInProd_withoutNewAlarm', () => {
    // Act
    const template = synth(prod);

    // Assert
    template.hasResourceProperties('AWS::Lambda::Function', {
      LoggingConfig: { LogGroup: { Ref: Match.stringLikeRegexp('^CatalogAdminLogs') } },
    });
    const alarms = Object.values(template.findResources('AWS::CloudWatch::Alarm'));
    expect(JSON.stringify(alarms)).not.toContain('CatalogAdmin');
  });
});
