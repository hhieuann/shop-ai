import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import type { ShopEnvironment } from '../lib/config.js';
import { productImagesBucketName, shopBaseUrlParameterName } from '../lib/product-images.js';
import { WebStack } from '../lib/web-stack.js';

// Ảnh sản phẩm admin tải lên (catalog.md BR-16, #561)

const staging: ShopEnvironment = { name: 'staging', stackPrefix: 'shop-stg', isProd: false };
const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };
const ACCOUNT = '111111111111';

function fakeWebDist(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-dist-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>test</title>');
  return dir;
}

const cache = new Map<string, { api: Template; web: Template }>();
function synth(shopEnv: ShopEnvironment): { api: Template; web: Template } {
  let result = cache.get(shopEnv.name);
  if (!result) {
    // Bỏ qua bước esbuild cho test chạy nhanh; đóng gói thật do `cdk synth` kiểm.
    const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
    const env = { account: ACCOUNT, region: 'ap-southeast-1' };
    const api = new ApiStack(app, 'TestApi', { shopEnv, env });
    const web = new WebStack(app, 'TestWeb', {
      shopEnv,
      env,
      httpApi: api.httpApi,
      userPoolId: api.userPool.userPoolId,
      userPoolClientId: api.webClient.userPoolClientId,
      webDistPath: fakeWebDist(),
    });
    result = { api: Template.fromStack(api), web: Template.fromStack(web) };
    cache.set(shopEnv.name, result);
  }
  return result;
}

interface Statement {
  readonly Action: unknown;
  readonly Resource: unknown;
  readonly Effect?: string;
  readonly Principal?: unknown;
  readonly Condition?: unknown;
}

function catalogAdminStatements(api: Template): Statement[] {
  return Object.values(api.findResources('AWS::IAM::Policy'))
    .filter((p) =>
      (p.Properties.Roles as { Ref: string }[]).some((r) =>
        r.Ref.startsWith('CatalogAdminFunctionServiceRole'),
      ),
    )
    .flatMap((p) => p.Properties.PolicyDocument.Statement as Statement[]);
}

describe('Ảnh sản phẩm · tên dùng chung hai stack', () => {
  it('bucketName_usesStackPrefixAndAccount', () => {
    expect(productImagesBucketName(staging, ACCOUNT)).toBe('shop-stg-product-images-111111111111');
    expect(
      productImagesBucketName(
        { name: 'sbx', stackPrefix: 'shop-sbx-hoang', isProd: false },
        ACCOUNT,
      ),
    ).toBe('shop-sbx-hoang-product-images-111111111111');
  });

  it('baseUrlParameter_followsRepoPattern', () => {
    expect(shopBaseUrlParameterName(staging)).toBe('/shop/staging/web/base-url');
  });

  it('stacks_haveNoCycle_apiDoesNotReferenceWeb', () => {
    // Act: synth cả hai stack; vòng phụ thuộc thì CDK ném lỗi ở đây
    const { api } = synth(staging);

    // Assert: stack api không import gì từ stack web
    expect(JSON.stringify(api.toJSON())).not.toContain('Fn::ImportValue');
  });
});

describe('Ảnh sản phẩm · bucket (stack web)', () => {
  it('bucket_isPrivateEncryptedTlsOnly_withFixedName', () => {
    // Act
    const { web } = synth(staging);

    // Assert
    web.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'shop-stg-product-images-111111111111',
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          { ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } },
        ],
      },
      Tags: Match.arrayWith([{ Key: 'module', Value: 'catalog' }]),
    });
  });

  it('bucket_corsAllowsOnlyPost', () => {
    // Act
    const { web } = synth(staging);

    // Assert: chỉ POST (vé ký sẵn); không GET, PUT, DELETE từ trình duyệt
    web.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: 'shop-stg-product-images-111111111111',
      CorsConfiguration: {
        CorsRules: [{ AllowedMethods: ['POST'], AllowedOrigins: ['*'], MaxAge: 3600 }],
      },
    });
  });

  it('bucketPolicy_letsOnlyThisDistributionRead_andDeniesPlainHttp', () => {
    // Act
    const { web } = synth(staging);
    const policies = Object.values(web.findResources('AWS::S3::BucketPolicy')).filter((p) =>
      JSON.stringify(p.Properties.Bucket).includes('ProductImagesBucket'),
    );
    const statements = policies.flatMap(
      (p) => p.Properties.PolicyDocument.Statement as Statement[],
    );

    // Assert: CloudFront đọc qua OAC, điều kiện đúng ARN distribution của stack này
    const read = statements.find(
      (s) => s.Effect === 'Allow' && JSON.stringify(s.Principal).includes('cloudfront'),
    );
    expect(read?.Action).toBe('s3:GetObject');
    expect(JSON.stringify(read?.Condition)).toContain('Distribution');
    expect(JSON.stringify(read?.Condition)).not.toContain('distribution/*');
    // enforceSSL: chặn mọi lệnh không qua TLS
    expect(
      statements.some(
        (s) => s.Effect === 'Deny' && JSON.stringify(s.Condition).includes('aws:SecureTransport'),
      ),
    ).toBe(true);
    // Verify: không cho ai khác đọc, ghi qua bucket policy
    for (const s of statements.filter((s) => s.Effect === 'Allow')) {
      expect(JSON.stringify(s.Principal)).not.toMatch(/"\*"|AWS":"\*/);
    }
  });

  it('bucket_isRetained_whenProd', () => {
    // Act
    const { web } = synth(prod);

    // Assert
    web.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Retain',
      Properties: Match.objectLike({ BucketName: 'shop-prd-product-images-111111111111' }),
    });
  });

  it('bucket_isDestroyedWithObjects_whenNotProd', () => {
    // Act
    const { web } = synth(staging);

    // Assert: như bucket web, xoá stack dev, staging thì xoá luôn ảnh
    web.hasResource('AWS::S3::Bucket', {
      DeletionPolicy: 'Delete',
      Properties: Match.objectLike({ BucketName: 'shop-stg-product-images-111111111111' }),
    });
  });
});

describe('Ảnh sản phẩm · CloudFront (stack web)', () => {
  it('imagesBehavior_readsBucketThroughOac_getHeadOnly_optimizedCache', () => {
    // Act
    const { web } = synth(staging);

    // Assert
    web.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({
            PathPattern: '/images/products/*',
            AllowedMethods: ['GET', 'HEAD'],
            // managed CachingOptimized
            CachePolicyId: '658327ea-f89d-4fab-a63d-7e88639e58f6',
            ViewerProtocolPolicy: 'redirect-to-https',
            FunctionAssociations: [Match.objectLike({ EventType: 'viewer-request' })],
          }),
        ]),
        Origins: Match.arrayWith([
          Match.objectLike({
            DomainName: {
              'Fn::GetAtt': [Match.stringLikeRegexp('^ProductImagesBucket'), 'RegionalDomainName'],
            },
            OriginAccessControlId: Match.anyValue(),
          }),
        ]),
      }),
    });
  });

  it.each([
    [
      '/images/products/01KAB3Q5G00000000000000001.webp',
      '/products/01KAB3Q5G00000000000000001.webp',
    ],
    ['/images/products/01KAB3Q5G00000000000000001.jpg', '/products/01KAB3Q5G00000000000000001.jpg'],
    ['/products/x.png', '/products/x.png'],
  ])('pathRewrite_maps_%s_to_%s', (uri, expected) => {
    // Arrange: chạy đúng mã Function trong template
    const { web } = synth(staging);
    const fns = Object.values(web.findResources('AWS::CloudFront::Function')) as {
      Properties: { FunctionCode: string; FunctionConfig: { Comment: string } };
    }[];
    const fn = fns.find((f) => f.Properties.FunctionConfig.Comment.includes('/images/products'));
    const context: { handler?: (e: unknown) => { uri: string } } = {};
    vm.runInNewContext(`${fn!.Properties.FunctionCode}; this.handler = handler;`, context);

    // Act
    const request = context.handler!({ request: { uri } });

    // Assert
    expect(request.uri).toBe(expected);
  });

  it('webStack_writesShopBaseUrlParameter_fromDistributionDomain', () => {
    // Act
    const { web } = synth(staging);

    // Assert
    web.hasResourceProperties('AWS::SSM::Parameter', {
      Name: '/shop/staging/web/base-url',
      Type: 'String',
      Value: {
        'Fn::Join': [
          '',
          ['https://', { 'Fn::GetAtt': [Match.stringLikeRegexp('^Distribution'), 'DomainName'] }],
        ],
      },
    });
  });
});

describe('Ảnh sản phẩm · Lambda admin sản phẩm (stack api)', () => {
  it('catalogAdminFunction_getsBucketAndParameterNames', () => {
    // Act
    const { api } = synth(staging);

    // Assert
    api.hasResourceProperties('AWS::Lambda::Function', {
      LoggingConfig: { LogGroup: { Ref: Match.stringLikeRegexp('^CatalogAdminLogs') } },
      Environment: {
        Variables: Match.objectLike({
          PRODUCT_IMAGES_BUCKET: 'shop-stg-product-images-111111111111',
          PRODUCT_IMAGES_BASE_URL_PARAM: '/shop/staging/web/base-url',
        }),
      },
    });
  });

  it('catalogAdminFunction_canOnlyPutUnderProductsPrefix', () => {
    // Act
    const statements = catalogAdminStatements(synth(staging).api);
    const s3 = statements.filter((s) => JSON.stringify(s.Action).includes('s3:'));

    // Assert
    expect(s3).toHaveLength(1);
    expect(s3[0]?.Action).toBe('s3:PutObject');
    expect(s3[0]?.Resource).toEqual({
      'Fn::Join': [
        '',
        [
          'arn:',
          { Ref: 'AWS::Partition' },
          ':s3:::shop-stg-product-images-111111111111/products/*',
        ],
      ],
    });
    // Verify: không đọc, không xoá, không liệt kê ảnh
    const all = JSON.stringify(statements);
    for (const forbidden of [
      's3:GetObject',
      's3:DeleteObject',
      's3:ListBucket',
      's3:PutObjectAcl',
      's3:*',
    ]) {
      expect(all).not.toContain(forbidden);
    }
  });

  it('catalogAdminFunction_readsOnlyShopBaseUrlParameter', () => {
    // Act
    const statements = catalogAdminStatements(synth(staging).api);
    const ssm = statements.filter((s) => JSON.stringify(s.Action).includes('ssm:'));

    // Assert
    expect(ssm).toHaveLength(1);
    expect(ssm[0]?.Action).toBe('ssm:GetParameter');
    expect(JSON.stringify(ssm[0]?.Resource)).toContain(':parameter/shop/staging/web/base-url');
    expect(JSON.stringify(statements)).not.toMatch(/ssm:GetParameters|ssm:PutParameter|kms:/);
  });
});
