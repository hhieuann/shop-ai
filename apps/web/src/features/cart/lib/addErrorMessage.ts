import { ApiError } from '../../../shared/api/client';

/**
 * Câu báo lỗi khi thêm vào giỏ, theo mã lỗi của CartProblem (cart.md "Trường hợp đặc biệt").
 * Dùng chung cho nút ở trang chi tiết (AddToCart) và nút trên thẻ trang danh sách.
 */
export function addErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Không kết nối được máy chủ, vui lòng thử lại.';
  switch (error.code) {
    case 'QUANTITY_LIMIT':
      return error.maxAddable
        ? `Chỉ thêm được tối đa ${error.maxAddable} sản phẩm nữa (giỏ đã có món này hoặc kho không đủ).`
        : 'Giỏ đã có số lượng tối đa của sản phẩm này.';
    case 'PRODUCT_UNAVAILABLE':
      return 'Sản phẩm đã ngừng bán.';
    case 'CART_FULL':
      return 'Giỏ hàng đã đủ 50 sản phẩm. Hãy đặt hàng hoặc xoá bớt.';
    default:
      return error.status === 401
        ? 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.'
        : (error.detail ?? error.title);
  }
}
