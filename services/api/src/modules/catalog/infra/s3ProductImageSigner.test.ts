import { describe, expect, it, vi } from 'vitest';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { S3ProductImageSigner } from './s3ProductImageSigner.js';

vi.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: vi.fn().mockResolvedValue({
    url: 'https://images-bucket.s3.ap-southeast-1.amazonaws.com/',
    fields: { key: 'products/X.png', 'Content-Type': 'image/png', Policy: 'p' },
  }),
}));

describe('S3ProductImageSigner (catalog.md BR-16)', () => {
  it('sign_passesSizeRangeContentTypeAndExpiry_toPresignedPost', async () => {
    // Arrange
    const s3 = new S3Client({ region: 'ap-southeast-1' });
    const signer = new S3ProductImageSigner(s3, 'images-bucket');

    // Act
    const result = await signer.sign({
      key: 'products/01KAB3Q5G00000000000000001.png',
      contentType: 'image/png',
      maxBytes: 3_145_728,
      expiresInSeconds: 300,
    });

    // Assert
    expect(result).toEqual({
      url: 'https://images-bucket.s3.ap-southeast-1.amazonaws.com/',
      fields: { key: 'products/X.png', 'Content-Type': 'image/png', Policy: 'p' },
    });
    // Verify: S3 tự từ chối tệp rỗng, quá 3 MB hoặc khác loại đã khai
    expect(createPresignedPost).toHaveBeenCalledWith(s3, {
      Bucket: 'images-bucket',
      Key: 'products/01KAB3Q5G00000000000000001.png',
      Conditions: [
        ['content-length-range', 1, 3_145_728],
        ['eq', '$Content-Type', 'image/png'],
      ],
      Fields: { 'Content-Type': 'image/png' },
      Expires: 300,
    });
  });
});
