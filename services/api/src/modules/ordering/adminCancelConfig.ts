/** Cấu hình admin huỷ đơn của Lambda admin, đọc từ biến môi trường */
export interface AdminCancelConfig {
  /** Bảng products: cộng kho trong giao dịch huỷ (ADR-0017) */
  readonly productsTable: string;
  /** Hàng đợi đơn: tin CANCELLED cho worker gửi thư (BR-13) */
  readonly ordersQueueUrl: string;
}

/** Hai biến hạ tầng thêm cho Lambda admin ở PR hạ tầng admin huỷ đơn (#449) */
export const ADMIN_CANCEL_ENV_VARS = ['PRODUCTS_TABLE', 'ORDERS_QUEUE_URL'] as const;

export type AdminCancelConfigResult =
  | { readonly enabled: true; readonly config: AdminCancelConfig }
  | { readonly enabled: false; readonly missing: readonly string[] };

/**
 * Đọc tuỳ chọn, không `requiredEnv` (như emailConfig, #265): code API (#448) merge trước khi hạ tầng
 * (#449) thêm biến và quyền cho Lambda admin đang chạy. Thiếu biến nào thì tắt huỷ đơn (DELETE báo
 * lỗi), xem và chuyển trạng thái vẫn chạy; trả tên biến thiếu để log.
 */
export function adminCancelConfig(
  env: Readonly<Record<string, string | undefined>>,
): AdminCancelConfigResult {
  const missing = ADMIN_CANCEL_ENV_VARS.filter((name) => !env[name]);
  if (missing.length > 0) return { enabled: false, missing };
  return {
    enabled: true,
    config: {
      productsTable: env.PRODUCTS_TABLE as string,
      ordersQueueUrl: env.ORDERS_QUEUE_URL as string,
    },
  };
}
