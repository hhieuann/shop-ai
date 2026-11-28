import { describe, expect, it, vi } from 'vitest';
import { createProductImageUpload } from './createProductImageUpload.js';

const NOW = new Date('2026-11-25T09:00:00.000Z');
const UPLOAD = { url: 'https://bucket.s3.ap-southeast-1.amazonaws.com/', fields: { key: 'k' } };

function deps(ids: string[] = ['01KAB3Q5G00000000000000001'], baseUrl = 'https://shop.example') {
  const source = { get: vi.fn().mockResolvedValue(baseUrl) };
  let i = 0;
  return {
    signer: { sign: vi.fn().mockResolvedValue(UPLOAD) },
    newId: () => ids[i++] ?? 'X',
    baseUrl: source,
    now: () => NOW,
  };
}

describe('createProductImageUpload (catalog.md BR-16)', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ] as const)('signs_%s_withServerKey_3MBLimit_300Seconds', async (contentType, ext) => {
    // Arrange
    const d = deps();

    // Act
    const result = await createProductImageUpload(d, { adminId: 'admin-1', contentType });

    // Assert
    expect(result).toEqual({
      upload: UPLOAD,
      imageUrl: `https://shop.example/images/products/01KAB3Q5G00000000000000001.${ext}`,
      expiresAt: '2026-11-25T09:05:00.000Z',
    });
    // Verify: khoá do server sinh, giới hạn 3 MB, vé sống 300 giây
    expect(d.signer.sign).toHaveBeenCalledTimes(1);
    expect(d.signer.sign).toHaveBeenCalledWith({
      key: `products/01KAB3Q5G00000000000000001.${ext}`,
      contentType,
      maxBytes: 3_145_728,
      expiresInSeconds: 300,
    });
  });

  it('usesNewKeyEachTime_soUploadsNeverOverwrite', async () => {
    // Arrange
    const d = deps(['01KAB3Q5G00000000000000001', '01KAB3Q5G00000000000000002']);

    // Act
    const a = await createProductImageUpload(d, { adminId: 'a', contentType: 'image/png' });
    const b = await createProductImageUpload(d, { adminId: 'a', contentType: 'image/png' });

    // Assert
    expect(a.imageUrl).not.toBe(b.imageUrl);
  });

  it('imageUrlIsFullHttps_trailingSlashOfBaseTrimmed', async () => {
    // Act
    const result = await createProductImageUpload(deps(undefined, 'https://d123.cloudfront.net/'), {
      adminId: 'a',
      contentType: 'image/webp',
    });

    // Assert
    expect(result.imageUrl).toBe(
      'https://d123.cloudfront.net/images/products/01KAB3Q5G00000000000000001.webp',
    );
  });

  it('throws_andSignsNothing_whenBaseUrlUnavailable', async () => {
    // Arrange: không đọc được tên miền shop (SSM lỗi hoặc giá trị sai)
    const d = deps();
    d.baseUrl.get.mockRejectedValue(new Error('Tham số /shop-dev/web/base-url không phải https'));

    // Act + Assert: lỗi thường, handler trả 500
    await expect(
      createProductImageUpload(d, { adminId: 'a', contentType: 'image/jpeg' }),
    ).rejects.toThrow();
    // Verify: không cấp vé khi chưa có đường dẫn ảnh
    expect(d.signer.sign).not.toHaveBeenCalled();
  });
});
