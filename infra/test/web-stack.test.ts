import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import type { ShopEnvironment } from '../lib/config.js';
import { WebStack } from '../lib/web-stack.js';

const dev: ShopEnvironment = { name: 'dev', stackPrefix: 'shop-dev', isProd: false };
const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };

/** Bản build web giả: chỉ cần thư mục có index.html để BucketDeployment đóng gói. */
function fakeWebDist(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-dist-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>test</title>');
  return dir;
}

function synth(shopEnv: ShopEnvironment): Template {
  // Bỏ qua bước esbuild cho test chạy nhanh; đóng gói thật do `cdk synth` kiểm.
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const env = { account: '111111111111', region: 'ap-southeast-1' };
  const api = new ApiStack(app, 'TestApi', { shopEnv, env });
  const web = new WebStack(app, 'TestWeb', {
    shopEnv,
    env,
    httpApi: api.httpApi,
    webDistPath: fakeWebDist(),
  });
  return Template.fromStack(web);
}

describe('WebStack', () => {
  it('webBucket_blocksAllPublicAccessAndRequiresTls', () => {
    // Act
    const template = synth(dev);

    // Assert: chỉ CloudFront đọc được bucket, không ai đọc thẳng từ Internet
    template.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    template.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  it('distribution_readsBucketThroughOriginAccessControl', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultRootObject: 'index.html',
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
      }),
    });
  });

  it('distribution_sendsApiPathToHttpApiWithoutCaching', () => {
    // Act
    const template = synth(dev);

    // Assert: /api/* đi thẳng tới API Gateway, mọi method, không cache (managed CachingDisabled)
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        CacheBehaviors: [
          Match.objectLike({
            PathPattern: '/api/*',
            AllowedMethods: ['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'POST', 'DELETE'],
            CachePolicyId: '4135ea2d-6df8-44a3-9df3-4b5a84be39ad',
            ViewerProtocolPolicy: 'https-only',
          }),
        ],
      }),
    });
  });

  it('spaRewrite_sendsPathsWithoutExtensionToIndexHtml', () => {
    // Act
    const template = synth(dev);

    // Assert: /products/abc là route của React, không phải file trong bucket
    const fns = template.findResources('AWS::CloudFront::Function');
    const code = Object.values(fns)
      .map((r) => (r as { Properties: { FunctionCode: string } }).Properties.FunctionCode)
      .join('\n');
    expect(code).toContain("'/index.html'");
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          FunctionAssociations: [Match.objectLike({ EventType: 'viewer-request' })],
        }),
      }),
    });
  });

  it('webDeployment_keepsOldFilesAndInvalidatesIndexHtml', () => {
    // Act
    const template = synth(dev);

    // Assert: không xoá file cũ có hash (trang đang mở vẫn tải được), chỉ làm mới index.html
    template.hasResourceProperties('Custom::CDKBucketDeployment', {
      Prune: false,
      DistributionPaths: ['/index.html'],
    });
  });

  it('webBucket_isRetainedWithStack_whenProd', () => {
    // Act
    const template = synth(prod);

    // Assert
    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
  });

  it('stack_exposesWebUrl', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasOutput('WebUrl', {});
  });
});
