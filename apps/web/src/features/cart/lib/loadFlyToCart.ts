import type { ComponentType } from 'react';

/**
 * Nạp lớp vẽ ô bay (`FlyToCart`) ở gói riêng, không nằm trong gói JS đầu tiên (design-system §9.25).
 * Tải lỗi (mạng chập chờn, file cũ đã bị xoá sau deploy) thì trả component rỗng: chỉ mất hiệu ứng,
 * trang không sập; flyToCart không bay vì lớp vẽ chưa báo sẵn sàng, nhãn số đổi ngay.
 */
export function loadFlyToCart(): Promise<{ default: ComponentType }> {
  return import('../components/FlyToCart').then(
    (m) => ({ default: m.FlyToCart }),
    () => ({ default: () => null }),
  );
}
