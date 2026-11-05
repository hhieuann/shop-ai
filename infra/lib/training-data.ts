import { Duration, RemovalPolicy, Tags, Validations } from 'aws-cdk-lib';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

export interface TrainingDataProps {
  readonly shopEnv: ShopEnvironment;
}

/**
 * Bucket dữ liệu huấn luyện của pipeline gợi ý mỗi đêm (nhan.md, ADR-0016).
 * Chỉ chứa dữ liệu đã ẩn danh: `userId` thay bằng HMAC trước khi ghi (events.md mục 2).
 *
 * Mã hoá SSE-KMS bằng khoá AWS quản lý `aws/s3`, bật bucket key (nhóm chốt ngày 17/10/2026):
 * khoá KMS riêng tốn khoảng $1/tháng mỗi môi trường, mà dữ liệu đã ẩn danh nên không cần key policy riêng.
 * Bucket key giảm số lần gọi KMS khi pipeline đọc, ghi nhiều file.
 */
export class TrainingData extends Construct {
  public readonly bucket: Bucket;

  constructor(scope: Construct, id: string, props: TrainingDataProps) {
    super(scope, id);
    const { shopEnv } = props;

    this.bucket = new Bucket(this, 'Bucket', {
      encryption: BucketEncryption.KMS_MANAGED,
      bucketKeyEnabled: true,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      // Threat model B4: file train bị sửa hay xoá nhầm thì còn bản cũ để khôi phục
      versioned: true,
      lifecycleRules: [
        {
          // Bản cũ chỉ để khôi phục ngắn hạn; giữ lâu thì tốn dung lượng
          noncurrentVersionExpiration: Duration.days(30),
          abortIncompleteMultipartUploadAfter: Duration.days(1),
        },
      ],
      // prod giữ lại khi xoá stack; môi trường khác xoá cả file bên trong
      removalPolicy: shopEnv.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !shopEnv.isProd,
    });
    Tags.of(this.bucket).add('module', 'recommendation');

    Validations.of(this.bucket).acknowledge({
      id: 'AwsSolutions-S1',
      reason:
        'Log truy cập S3 tốn thêm một bucket; ai đọc, ghi bucket này sẽ theo dõi bằng CloudTrail data events khi làm review IAM (threat model B4).',
    });
  }
}
