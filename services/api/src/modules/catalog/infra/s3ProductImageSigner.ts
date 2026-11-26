import type { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import type { ProductImageSigner, ProductImageUpload } from '../ports.js';

/**
 * Ký presigned POST cho bucket ảnh sản phẩm (catalog.md BR-16). Điều kiện ký kèm vé:
 * - `content-length-range` 1 … `maxBytes`: S3 từ chối tệp rỗng hoặc quá cỡ;
 * - `Content-Type` đúng loại đã khai (khoá cũng mang đuôi tương ứng);
 * - khoá cố định do server sinh. Role Lambda chỉ có `s3:PutObject` trên `products/*` (hạ tầng #561).
 */
export class S3ProductImageSigner implements ProductImageSigner {
  constructor(
    private readonly s3: S3Client,
    private readonly bucket: string,
  ) {}

  async sign(input: {
    readonly key: string;
    readonly contentType: string;
    readonly maxBytes: number;
    readonly expiresInSeconds: number;
  }): Promise<ProductImageUpload> {
    const { url, fields } = await createPresignedPost(this.s3, {
      Bucket: this.bucket,
      Key: input.key,
      Conditions: [
        ['content-length-range', 1, input.maxBytes],
        ['eq', '$Content-Type', input.contentType],
      ],
      Fields: { 'Content-Type': input.contentType },
      Expires: input.expiresInSeconds,
    });
    return { url, fields };
  }
}
