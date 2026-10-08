import { json, type HttpResult } from '../../shared/http/response.js';

/**
 * GET /api/v1/health: chỉ báo API còn nhận request, không đọc DynamoDB.
 * Không cache ở đâu cả, để smoke test luôn thấy trạng thái thật.
 */
export async function handler(): Promise<HttpResult> {
  const result = json(200, { status: 'ok' });
  return { ...result, headers: { ...result.headers, 'cache-control': 'no-store' } };
}
