import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import type { ShopEnvironment } from '../lib/config.js';
import { TrainingData } from '../lib/training-data.js';

const dev: ShopEnvironment = { name: 'dev', stackPrefix: 'shop-dev', isProd: false };
const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };

/** Dựng TrainingData trong một stack trống: test chỉ phần bucket, không cần cả ApiStack. */
function synth(shopEnv: ShopEnvironment): Template {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { region: 'ap-southeast-1' } });
  new TrainingData(stack, 'TrainingData', { shopEnv });
  return Template.fromStack(stack);
}

describe('TrainingData', () => {
  it('bucket_usesAwsManagedKmsKeyWithBucketKey', () => {
    // Act
    const template = synth(dev);

    // Assert: SSE-KMS bằng khoá aws/s3 (không có KMSMasterKeyID riêng), bật bucket key
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: 'aws:kms',
              KMSMasterKeyID: Match.absent(),
            },
            BucketKeyEnabled: true,
          },
        ],
      },
    });
    template.resourceCountIs('AWS::KMS::Key', 0);
  });

  it('bucket_blocksAllPublicAccessAndRequiresTls', () => {
    // Act
    const template = synth(dev);

    // Assert
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

  it('bucket_keepsOldVersionsThirtyDays', () => {
    // Act
    const template = synth(dev);

    // Assert: khôi phục được file bị sửa hay xoá nhầm, nhưng không giữ bản cũ mãi
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: { Status: 'Enabled' },
      LifecycleConfiguration: {
        Rules: [
          Match.objectLike({
            Status: 'Enabled',
            NoncurrentVersionExpiration: { NoncurrentDays: 30 },
            AbortIncompleteMultipartUpload: { DaysAfterInitiation: 1 },
          }),
        ],
      },
    });
  });

  it('bucket_isRetainedWithStack_whenProd', () => {
    // Act
    const template = synth(prod);

    // Assert
    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Retain' });
  });

  it('bucket_isDeletedWithStack_whenNotProd', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasResource('AWS::S3::Bucket', { DeletionPolicy: 'Delete' });
  });

  it('bucket_isTaggedWithRecommendationModule', () => {
    // Act
    const template = synth(dev);

    // Assert: chi phí lọc được theo module trong Cost Explorer
    template.hasResourceProperties('AWS::S3::Bucket', {
      Tags: Match.arrayWith([{ Key: 'module', Value: 'recommendation' }]),
    });
  });
});
