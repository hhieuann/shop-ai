import { describe, expect, it } from 'vitest';
import { ApiError } from '../../../shared/api/client';
import { addErrorMessage } from './addErrorMessage';

const conflict = (extra: Record<string, unknown>) => new ApiError(409, extra, 'Conflict');

describe('addErrorMessage', () => {
  it.each([
    {
      name: 'QUANTITY_LIMIT còn thêm được',
      error: conflict({ code: 'QUANTITY_LIMIT', maxAddable: 2 }),
      text: 'Chỉ thêm được tối đa 2 sản phẩm nữa (giỏ đã có món này hoặc kho không đủ).',
    },
    {
      name: 'QUANTITY_LIMIT đã đủ',
      error: conflict({ code: 'QUANTITY_LIMIT', maxAddable: 0 }),
      text: 'Giỏ đã có số lượng tối đa của sản phẩm này.',
    },
    {
      name: 'PRODUCT_UNAVAILABLE',
      error: conflict({ code: 'PRODUCT_UNAVAILABLE' }),
      text: 'Sản phẩm đã ngừng bán.',
    },
    {
      name: 'CART_FULL',
      error: conflict({ code: 'CART_FULL' }),
      text: 'Giỏ hàng đã đủ 50 sản phẩm. Hãy đặt hàng hoặc xoá bớt.',
    },
    {
      name: 'hết phiên',
      error: new ApiError(401, {}, 'Unauthorized'),
      text: 'Phiên đăng nhập đã hết. Vui lòng đăng nhập lại.',
    },
    {
      name: 'không phải lỗi API',
      error: new TypeError('Failed to fetch'),
      text: 'Không kết nối được máy chủ, vui lòng thử lại.',
    },
  ])('$name', ({ error, text }) => {
    expect(addErrorMessage(error)).toBe(text);
  });
});
