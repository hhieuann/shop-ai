/** Cấu hình bước gửi thư của worker order-processor, đọc từ biến môi trường của Lambda */
export interface EmailConfig {
  readonly userPoolId: string;
  readonly idempotencyTable: string;
  readonly senderEmail: string;
}

/** Ba biến hạ tầng thêm cho worker ở PR quyền SES, Cognito (issue ③b) */
export const EMAIL_ENV_VARS = ['USER_POOL_ID', 'ORDER_IDEMPOTENCY_TABLE', 'SENDER_EMAIL'] as const;

export type EmailConfigResult =
  | { readonly enabled: true; readonly config: EmailConfig }
  | { readonly enabled: false; readonly missing: readonly string[] };

/**
 * Đọc tuỳ chọn, không `requiredEnv`: code gửi thư merge trước khi hạ tầng thêm các biến này vào Lambda
 * worker đang chạy (#263), và môi trường không có `-c senderEmail` thì không có `SENDER_EMAIL`.
 * Thiếu biến nào thì tắt bước thư (worker vẫn xác nhận đơn, gửi tin); trả tên biến thiếu để log.
 */
export function emailConfig(env: Readonly<Record<string, string | undefined>>): EmailConfigResult {
  const missing = EMAIL_ENV_VARS.filter((name) => !env[name]);
  if (missing.length > 0) return { enabled: false, missing };
  return {
    enabled: true,
    config: {
      userPoolId: env.USER_POOL_ID as string,
      idempotencyTable: env.ORDER_IDEMPOTENCY_TABLE as string,
      senderEmail: env.SENDER_EMAIL as string,
    },
  };
}
