/**
 * Ảnh sản phẩm admin tải lên (catalog.md BR-16): loại tệp, cỡ tối đa, khoá trên S3 và đường dẫn
 * công khai. Hàm thuần, không I/O.
 */

/** Loại tệp được nhận và đuôi tệp lưu trên S3 (JPG và JPEG cùng là `image/jpeg`, lưu `.jpg`) */
export const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type ImageContentType = keyof typeof IMAGE_TYPES;
export const IMAGE_CONTENT_TYPES = Object.keys(IMAGE_TYPES) as ImageContentType[];

/** Tối đa 3 MB (3 × 1024 × 1024 byte), Hoàng chốt 25/11/2026 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Vé tải lên sống 5 phút: đủ cho ảnh 3 MB trên mạng chậm, hết hạn thì xin vé mới */
export const UPLOAD_EXPIRES_SECONDS = 300;

/**
 * Khoá trên S3 do server sinh từ ULID mới, không dùng tên tệp người dùng: không ghi đè ảnh có sẵn,
 * không lộ tên tệp trên máy admin, không có ký tự lạ trong đường dẫn.
 */
export function imageKey(id: string, contentType: ImageContentType): string {
  return `products/${id}.${IMAGE_TYPES[contentType]}`;
}

/** Tên miền shop hợp lệ để ghép đường dẫn ảnh: `https://<host>`, có thể có `/` ở cuối */
export function isShopBaseUrl(value: string): boolean {
  return /^https:\/\/[^/\s]+\/?$/.test(value);
}

/**
 * Đường dẫn công khai qua CloudFront (`/images/products/*`): `baseUrl` là tên miền shop dạng
 * `https://<cloudfront>` (productImagesConfig kiểm), kết quả là https đầy đủ như contract yêu cầu.
 */
export function imagePublicUrl(baseUrl: string, key: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/images/${key}`;
}
