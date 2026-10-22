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

/** Hai tham số của chuyển trang theo cursor (pages/danh-sach-san-pham.md §1) */
const PAGING_KEYS = ['cursor', 'page'] as const;

export interface PageInfo {
  /** Cursor của trang đang xem (nextCursor của trang trước); không có là trang 1 */
  cursor?: string;
  /** Số trang để hiện "Trang N"; chỉ để hiển thị, API không biết số trang */
  page: number;
}

/**
 * Đọc trang đang xem từ URL. Không có cursor là trang 1 (bỏ qua page).
 * Có cursor mà page thiếu hoặc không phải số nguyên ≥ 2 thì coi là trang 2:
 * chắc chắn không phải trang 1, chỉ không biết chính xác số trang.
 */
export function pageFromSearchParams(params: URLSearchParams): PageInfo {
  const cursor = params.get('cursor') || undefined;
  if (!cursor) return { page: 1 };
  const raw = params.get('page') ?? '';
  const page = /^\d{1,6}$/.test(raw) ? Number(raw) : 0;
  return { cursor, page: page >= 2 ? page : 2 };
}

/** Bản sao query string không có cursor, page */
export function withoutPaging(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  for (const key of PAGING_KEYS) next.delete(key);
  return next;
}

/**
 * Đổi loại hàng hoặc cách sắp xếp: ghi giá trị mới (rỗng hoặc mặc định thì xoá khỏi URL)
 * và về trang 1 (xoá cursor, page).
 */
export function withFilter(
  params: URLSearchParams,
  key: 'category' | 'sort',
  value: string | undefined,
): URLSearchParams {
  const next = withoutPaging(params);
  const isDefault = !value || (key === 'sort' && value === DEFAULT_SORT);
  if (isDefault) next.delete(key);
  else next.set(key, value);
  return next;
}

/** Sang trang khác: trang 1 (hoặc không có cursor) thì bỏ cả cursor và page khỏi URL */
export function withPage(
  params: URLSearchParams,
  cursor: string | undefined,
  page: number,
): URLSearchParams {
  const next = withoutPaging(params);
  if (cursor && page >= 2) {
    next.set('cursor', cursor);
    next.set('page', String(page));
  }
  return next;
}

/**
 * Query string bỏ cursor, page, để so với link "Mua theo nhu cầu" trên header:
 * trang 2 của ?category=gpu vẫn khớp "Chơi game". Không có hai tham số này thì trả nguyên chuỗi.
 */
export function searchWithoutPaging(search: string): string {
  const params = new URLSearchParams(search);
  if (!PAGING_KEYS.some((key) => params.has(key))) return search;
  const rest = withoutPaging(params).toString();
  return rest ? `?${rest}` : '';
}
