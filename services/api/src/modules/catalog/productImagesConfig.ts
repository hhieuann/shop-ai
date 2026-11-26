/** Cấu hình tải ảnh sản phẩm của Lambda admin sản phẩm (catalog.md BR-16), đọc từ biến môi trường */
export interface ProductImagesConfig {
  /** Bucket ảnh riêng (hạ tầng #561) */
  readonly bucket: string;
  /**
   * Tên tham số SSM chứa tên miền shop `https://<cloudfront>` (vd. `/shop/<env>/web/base-url`, stack
   * web ghi). Chỉ là tên tham số; giá trị đọc lúc xin vé đầu (infra/ssmShopBaseUrl.ts)
   */
  readonly baseUrlParameter: string;
}

export type ProductImagesConfigResult =
  | { readonly enabled: true; readonly config: ProductImagesConfig }
  | { readonly enabled: false; readonly missing: readonly string[] };

/**
 * Đọc tuỳ chọn như adminCancelConfig (#448): code API (#560) có thể merge trước khi hạ tầng (#561)
 * thêm bucket và tham số. Thiếu `PRODUCT_IMAGES_BUCKET`, hoặc `PRODUCT_IMAGES_BASE_URL_PARAM` không
 * phải tên tham số SSM (bắt đầu bằng `/`), thì tắt tải ảnh (route báo 500, có log); các route khác
 * vẫn chạy.
 */
export function productImagesConfig(
  env: Readonly<Record<string, string | undefined>>,
): ProductImagesConfigResult {
  const missing = [
    ...(env.PRODUCT_IMAGES_BUCKET ? [] : ['PRODUCT_IMAGES_BUCKET']),
    ...(/^\/[\w./-]+$/.test(env.PRODUCT_IMAGES_BASE_URL_PARAM ?? '')
      ? []
      : ['PRODUCT_IMAGES_BASE_URL_PARAM']),
  ];
  if (missing.length > 0) return { enabled: false, missing };
  return {
    enabled: true,
    config: {
      bucket: env.PRODUCT_IMAGES_BUCKET as string,
      baseUrlParameter: env.PRODUCT_IMAGES_BASE_URL_PARAM as string,
    },
  };
}
