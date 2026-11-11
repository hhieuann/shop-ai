import { getAccessToken } from '../auth/token';
import { api } from './client';
import type { EventInput, EventType } from './types';

/**
 * Ghi một lượt xem hoặc thêm giỏ (POST /api/v1/events, events.md mục 1) làm dữ liệu cho gợi ý.
 * Gửi rồi quên, không bao giờ ném lỗi:
 * - chưa đăng nhập thì không gửi (route bắt buộc đăng nhập, không ghi khách vãng lai, threat model E2);
 * - lỗi gì cũng bỏ qua, không thử lại: mất một lượt không ảnh hưởng khách;
 * - `keepalive` để sự kiện vẫn đi khi khách chuyển trang ngay sau đó.
 */
export async function recordEvent(productId: string, eventType: EventType): Promise<void> {
  try {
    if (!(await getAccessToken())) return;
    const body: EventInput = { productId, eventType };
    await api.post<void>('/events', body, { keepalive: true });
  } catch {
    // Không báo lên giao diện, không ghi log: sự kiện chỉ để tính gợi ý
  }
}
