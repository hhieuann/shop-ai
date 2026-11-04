import { useEffect, useRef } from 'react';
import { recordEvent } from '../../../shared/api/events';
import { useSession } from '../../../shared/auth/useSession';

/**
 * Ghi lượt xem (VIEW) khi khách đã đăng nhập mở trang chi tiết (events.md mục 1).
 * Truyền `productId` chỉ khi đã tải được sản phẩm; đang tải, 404 hay lỗi thì truyền undefined.
 * Mỗi sản phẩm gửi một lần cho tới khi đổi sang sản phẩm khác (kể cả StrictMode và tải lại dữ liệu);
 * phiên còn đang đọc thì chờ, biết đã đăng nhập mới gửi.
 */
export function useRecordView(productId: string | undefined) {
  const session = useSession();
  const sentFor = useRef<string | null>(null);

  useEffect(() => {
    if (!productId || session !== 'signedIn' || sentFor.current === productId) return;
    sentFor.current = productId;
    void recordEvent(productId, 'VIEW');
  }, [productId, session]);
}
