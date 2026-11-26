// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeXhr } from './fakeXhr';
import {
  checkImageFile,
  imageContentType,
  isUploadedImage,
  MAX_IMAGE_BYTES,
  UPLOAD_FAILED,
  UploadAbortedError,
  uploadImageFile,
} from './productImage';

const fileOf = (name: string, type: string, size: number) =>
  new File([new Uint8Array(size)], name, { type });

describe('checkImageFile (catalog.md BR-16)', () => {
  it.each([
    ['anh.jpg', 'image/jpeg'],
    ['anh.JPEG', 'image/jpeg'],
    ['anh.png', 'image/png'],
    ['anh.webp', 'image/webp'],
  ])('accepts_%s', (name, type) => {
    expect(checkImageFile(fileOf(name, type, 1024))).toBeNull();
  });

  it('accepts_exactly3MB', () => {
    expect(checkImageFile(fileOf('a.png', 'image/png', MAX_IMAGE_BYTES))).toBeNull();
  });

  it.each([
    ['SVG', fileOf('a.svg', 'image/svg+xml', 10), 'Chỉ nhận ảnh JPG, PNG hoặc WebP.'],
    ['GIF', fileOf('a.gif', 'image/gif', 10), 'Chỉ nhận ảnh JPG, PNG hoặc WebP.'],
    ['PDF đổi đuôi', fileOf('a.jpg', 'application/pdf', 10), 'Chỉ nhận ảnh JPG, PNG hoặc WebP.'],
    ['tệp rỗng', fileOf('a.jpg', 'image/jpeg', 0), 'Tệp ảnh rỗng. Chọn ảnh khác.'],
    [
      'quá 3 MB một byte',
      fileOf('a.jpg', 'image/jpeg', MAX_IMAGE_BYTES + 1),
      'Ảnh tối đa 3 MB. Chọn ảnh nhỏ hơn.',
    ],
  ])('rejects_%s', (_name, file, message) => {
    expect(checkImageFile(file)).toBe(message);
  });

  it('guessesTypeFromExtension_whenBrowserLeavesTypeEmpty', () => {
    expect(imageContentType(fileOf('a.webp', '', 10))).toBe('image/webp');
    expect(imageContentType(fileOf('a.bmp', '', 10))).toBeNull();
  });
});

describe('isUploadedImage', () => {
  it('true_forShopImagesPath_falseForOtherLinks', () => {
    expect(isUploadedImage('https://d111111abcdef8.cloudfront.net/images/products/01K.webp')).toBe(
      true,
    );
    expect(isUploadedImage('https://example.com/a.webp')).toBe(false);
    expect(isUploadedImage('')).toBe(false);
  });
});

describe('uploadImageFile', () => {
  const upload = {
    url: 'https://bucket.s3.ap-southeast-1.amazonaws.com/',
    fields: { key: 'products/01K.jpg', 'Content-Type': 'image/jpeg', Policy: 'p' },
  };

  beforeEach(() => {
    FakeXhr.reset();
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('postsFieldsBeforeFile_andReportsProgress', async () => {
    // Arrange
    const onProgress = vi.fn();

    // Act
    const running = uploadImageFile(upload, fileOf('a.jpg', 'image/jpeg', 100), onProgress);
    const xhr = FakeXhr.last()!;
    xhr.progress(25, 100);
    xhr.progress(100, 100);
    xhr.respond(204);
    await running.done;

    // Assert: S3 cần mọi trường của vé trước, file cuối cùng
    expect(xhr.method).toBe('POST');
    expect(xhr.url).toBe(upload.url);
    expect(xhr.fieldNames()).toEqual(['key', 'Content-Type', 'Policy', 'file']);
    expect(onProgress.mock.calls).toEqual([[25], [100]]);
  });

  it.each([403, 400, 500])('rejects_withUploadFailed_whenS3Returns_%i', async (status) => {
    // Act
    const running = uploadImageFile(upload, fileOf('a.jpg', 'image/jpeg', 1), vi.fn());
    FakeXhr.last()!.respond(status);

    // Assert
    await expect(running.done).rejects.toThrow(UPLOAD_FAILED);
  });

  it('rejects_withUploadFailed_onNetworkError', async () => {
    const running = uploadImageFile(upload, fileOf('a.jpg', 'image/jpeg', 1), vi.fn());
    FakeXhr.last()!.fail();
    await expect(running.done).rejects.toThrow(UPLOAD_FAILED);
  });

  it('abort_rejectsWithAbortedError', async () => {
    const running = uploadImageFile(upload, fileOf('a.jpg', 'image/jpeg', 1), vi.fn());
    running.abort();
    await expect(running.done).rejects.toBeInstanceOf(UploadAbortedError);
    expect(FakeXhr.last()!.aborted).toBe(true);
  });
});
