/**
 * Chỗ của khối "Đang được mua nhiều" (trang-chu.md §3.6), khối sản phẩm đầu tiên ngay dưới
 * hàng đầu trang. Widget gợi ý của An sẽ đặt ở đây: StoryBlock + Carousel + ProductCard
 * (như ProductRail), dữ liệu từ GET /api/v1/recs (khách chưa đăng nhập nhận hàng bán chạy theo
 * loại, ADR-0016). Đã đăng nhập thì đổi tiêu đề thành "Dành cho bạn" (§7).
 *
 * Chưa có API nên chưa hiện gì: theo spec, API không trả gì thì ẩn khối, không để khối rỗng.
 */
export function PopularProducts() {
  return null;
}
