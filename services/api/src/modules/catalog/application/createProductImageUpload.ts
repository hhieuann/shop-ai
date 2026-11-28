import { logger } from '../../../shared/logger.js';
import {
  imageKey,
  imagePublicUrl,
  MAX_IMAGE_BYTES,
  UPLOAD_EXPIRES_SECONDS,
  type ImageContentType,
} from '../domain/productImage.js';
import type { ProductImageSigner, ProductImageUpload, ShopBaseUrlSource } from '../ports.js';

export interface CreateProductImageUploadDeps {
  readonly signer: ProductImageSigner;
  /** Sinh ULID mới cho tên tệp */
  readonly newId: () => string;
  /** Tên miền shop dạng https (`https://<cloudfront>`), gốc của đường dẫn ảnh công khai */
  readonly baseUrl: ShopBaseUrlSource;
  readonly now: () => Date;
}

export interface ProductImageUploadResult {
  readonly upload: ProductImageUpload;
  /** Đường dẫn ảnh sau khi tải xong; web điền vào ô ảnh rồi lưu sản phẩm như thường */
  readonly imageUrl: string;
  /** Lúc vé hết hạn (ISO 8601 UTC) */
  readonly expiresAt: string;
}

/**
 * Admin xin vé tải ảnh sản phẩm (catalog.md BR-16): loại và cỡ đã kiểm ở handler; vé có điều kiện
 * cỡ 1 B … 3 MB và đúng `Content-Type`, nên S3 tự từ chối tệp khác những gì đã khai.
 */
export async function createProductImageUpload(
  deps: CreateProductImageUploadDeps,
  input: { readonly adminId: string; readonly contentType: ImageContentType },
): Promise<ProductImageUploadResult> {
  // Đọc tên miền trước khi ký: không đọc được thì không cấp vé (handler trả 500)
  const baseUrl = await deps.baseUrl.get();
  const key = imageKey(deps.newId(), input.contentType);
  const upload = await deps.signer.sign({
    key,
    contentType: input.contentType,
    maxBytes: MAX_IMAGE_BYTES,
    expiresInSeconds: UPLOAD_EXPIRES_SECONDS,
  });
  const expiresAt = new Date(deps.now().getTime() + UPLOAD_EXPIRES_SECONDS * 1000).toISOString();
  logger.info('Admin xin vé tải ảnh sản phẩm', {
    adminId: input.adminId,
    key,
    action: 'UPLOAD_IMAGE',
  });
  return { upload, imageUrl: imagePublicUrl(baseUrl, key), expiresAt };
}
