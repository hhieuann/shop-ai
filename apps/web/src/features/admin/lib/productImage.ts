import { api } from '../../../shared/api/client';
import type { ProductImageUpload, ProductImageUploadRequest } from '../../../shared/api/types';

/** Ảnh sản phẩm admin tải lên (catalog.md BR-16): JPG/JPEG, PNG, WebP, tối đa 3 MB */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
type ImageContentType = ProductImageUploadRequest['contentType'];

const TYPE_BY_EXTENSION: Readonly<Record<string, ImageContentType>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};
const ALLOWED_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp'];

/** Câu lỗi khi tải hỏng vì mạng, API hoặc S3 từ chối (vé hết hạn, sai cỡ, sai loại) */
export const UPLOAD_FAILED = 'Chưa tải được ảnh. Thử lại.';

/**
 * Loại ảnh của tệp, hoặc `null` nếu không nhận. Tin `file.type` của trình duyệt trước; có máy để trống
 * (Windows thiếu đăng ký đuôi .webp) thì đoán theo đuôi. S3 vẫn kiểm lại `Content-Type` theo vé.
 */
export function imageContentType(file: File): ImageContentType | null {
  if (ALLOWED_TYPES.includes(file.type)) return file.type as ImageContentType;
  if (file.type !== '') return null;
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return TYPE_BY_EXTENSION[ext] ?? null;
}

/** Kiểm tệp trước khi xin vé: câu lỗi hiện dưới khung ảnh, hoặc `null` nếu hợp lệ */
export function checkImageFile(file: File): string | null {
  if (imageContentType(file) === null) return 'Chỉ nhận ảnh JPG, PNG hoặc WebP.';
  if (file.size === 0) return 'Tệp ảnh rỗng. Chọn ảnh khác.';
  if (file.size > MAX_IMAGE_BYTES) return 'Ảnh tối đa 3 MB. Chọn ảnh nhỏ hơn.';
  return null;
}

/** Ảnh nằm trong bucket ảnh của shop (đã tải lên), không phải đường dẫn dán từ nơi khác */
export function isUploadedImage(url: string): boolean {
  return /^https:\/\/[^/\s]+\/images\/products\/\S+$/.test(url.trim());
}

/** Xin vé tải ảnh (`POST /api/v1/admin/product-images`) */
export function requestImageUpload(file: File): Promise<ProductImageUpload> {
  const contentType = imageContentType(file);
  if (contentType === null) return Promise.reject(new Error('Loại ảnh không hỗ trợ'));
  return api.post<ProductImageUpload>('/admin/product-images', { contentType, size: file.size });
}

/** Người dùng bấm X khi đang tải: không phải lỗi, không báo */
export class UploadAbortedError extends Error {
  constructor() {
    super('Đã huỷ tải ảnh');
    this.name = 'UploadAbortedError';
  }
}

export interface RunningUpload {
  readonly done: Promise<void>;
  readonly abort: () => void;
}

/**
 * POST tệp thẳng lên S3 bằng vé đã ký. Dùng XMLHttpRequest vì fetch chưa báo tiến độ tải lên.
 *
 * Gắn `xhr.upload.onprogress` làm trình duyệt gửi preflight OPTIONS trước; S3 tự trả lời theo luật
 * CORS của bucket (cho POST, hạ tầng #561), miễn không thêm header lạ. Vì vậy không gửi Authorization
 * (vé đã ký), không tự đặt Content-Type (FormData tự đặt multipart kèm boundary).
 * Thứ tự trường theo S3: mọi trường của vé trước, `file` sau cùng.
 */
export function uploadImageFile(
  upload: ProductImageUpload['upload'],
  file: File,
  onProgress: (percent: number) => void,
): RunningUpload {
  const xhr = new XMLHttpRequest();
  const done = new Promise<void>((resolve, reject) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(upload.fields)) form.append(name, value);
    form.append('file', file);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    };
    // S3 trả 204 khi nhận tệp; 403 (vé hết hạn), 400 (sai cỡ, sai loại) là từ chối
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(UPLOAD_FAILED));
    xhr.onerror = () => reject(new Error(UPLOAD_FAILED));
    xhr.onabort = () => reject(new UploadAbortedError());
    xhr.open('POST', upload.url);
    xhr.send(form);
  });
  return { done, abort: () => xhr.abort() };
}
