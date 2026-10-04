/**
 * Tìm theo tên (catalog.md BR-03): không phân biệt hoa thường và dấu tiếng Việt,
 * khớp ở bất kỳ vị trí nào trong tên.
 */
import type { Product } from './product.js';

export const SEARCH_MIN_LENGTH = 1;
export const SEARCH_MAX_LENGTH = 30;

/**
 * Đưa chuỗi về dạng so khớp: chữ thường, bỏ dấu, gộp khoảng trắng.
 * Dùng cho cả tên sản phẩm (lúc nạp cache) và từ khoá `q` (lúc tìm).
 *
 * - `normalize('NFD')` tách "ộ" thành "o" + dấu, rồi xoá các dấu (khối U+0300–U+036F)
 * - "đ" là chữ riêng, NFD không tách được thành "d" + dấu, nên đổi tay
 */
export function toSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sản phẩm kèm tên đã chuẩn hoá, tính một lần khi nạp cache thay vì mỗi lần tìm. */
export type SearchableProduct = Product & { readonly searchText: string };

export function withSearchText(product: Product): SearchableProduct {
  return { ...product, searchText: toSearchText(product.name) };
}

/** `needle` là từ khoá đã qua toSearchText. */
export function matchesSearch(product: SearchableProduct, needle: string): boolean {
  return product.searchText.includes(needle);
}
