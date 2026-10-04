/**
 * Luật lọc và tìm sản phẩm phía web (catalog.md BR-02, BR-03).
 * Hàm thuần: không React, không fetch, test được bằng Vitest thường.
 */

import type { ProductCategory, ProductSort } from '../../../shared/api/types';

export type { ProductCategory, ProductSort };

/**
 * Nhãn tiếng Việt cho từng loại (BR-02). Kiểu `Record<ProductCategory, string>` buộc
 * có đủ và đúng mọi giá trị trong OpenAPI: thêm, bớt hay gõ sai một loại là TypeScript báo lỗi.
 */
const CATEGORY_LABELS: Record<ProductCategory, string> = {
  laptop: 'Laptop',
  cpu: 'CPU',
  gpu: 'Card đồ hoạ',
  ram: 'RAM',
  storage: 'Ổ cứng',
  mainboard: 'Mainboard',
  psu: 'Nguồn',
  cooling: 'Tản nhiệt',
  keyboard: 'Bàn phím',
  mouse: 'Chuột',
  monitor: 'Màn hình',
  headset: 'Tai nghe',
  accessory: 'Phụ kiện', // túi, balo, hub USB, cáp, đế tản nhiệt (catalog.md BR-02)
};

export const CATEGORIES = Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
  value: value as ProductCategory,
  label,
}));

/** catalog.md BR-08 */
const SORT_LABELS: Record<ProductSort, string> = {
  newest: 'Mới nhất',
  price_asc: 'Giá tăng dần',
  price_desc: 'Giá giảm dần',
};

export const SORTS = Object.entries(SORT_LABELS).map(([value, label]) => ({
  value: value as ProductSort,
  label,
}));

/** Mặc định của server khi không truyền sort */
export const DEFAULT_SORT: ProductSort = 'newest';

export const SEARCH_MIN_LENGTH = 1;
export const SEARCH_MAX_LENGTH = 30;

export interface ProductFilters {
  q?: string;
  category?: ProductCategory;
  /** undefined = mặc định của server (newest), để URL gọn */
  sort?: ProductSort;
}

/** Từ khoá hợp lệ để gửi lên API, hoặc undefined nếu rỗng (BR-03) */
export function normalizeSearch(raw: string | null | undefined): string | undefined {
  const q = (raw ?? '').trim().slice(0, SEARCH_MAX_LENGTH);
  return q.length >= SEARCH_MIN_LENGTH ? q : undefined;
}

function isCategory(value: string | null): value is ProductCategory {
  return value !== null && Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, value);
}

function isSort(value: string | null): value is ProductSort {
  return value !== null && Object.prototype.hasOwnProperty.call(SORT_LABELS, value);
}

/** Đọc bộ lọc từ URL; giá trị lạ (?category=abc) bị bỏ qua thay vì gửi lên API để nhận 400 */
export function filtersFromSearchParams(params: URLSearchParams): ProductFilters {
  const category = params.get('category');
  const sort = params.get('sort');
  return {
    q: normalizeSearch(params.get('q')),
    category: isCategory(category) ? category : undefined,
    sort: isSort(sort) && sort !== DEFAULT_SORT ? sort : undefined,
  };
}

/** Dựng query string cho GET /api/v1/products; chỉ đưa vào tham số có giá trị */
export function toProductsQuery(filters: ProductFilters, cursor?: string, limit = 20): string {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.category) params.set('category', filters.category);
  if (filters.sort) params.set('sort', filters.sort);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));
  return `?${params.toString()}`;
}
