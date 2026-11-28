/**
 * Bộ lọc của danh sách sản phẩm admin trên URL (pages/admin-san-pham.md mục 2): loại hàng (mặc định
 * Laptop), trạng thái, từ khoá, trang và cursor. Hàm thuần để test không cần React.
 */
import type { AdminProductStatusFilter, ProductCategory } from '../../../shared/api/types';
import { CATEGORIES } from '../../catalog/lib/productFilters';

export const DEFAULT_ADMIN_CATEGORY: ProductCategory = 'laptop';
/** Như API (catalog.md BR-10) và web khách (BR-03): từ khoá tối đa 30 ký tự */
export const ADMIN_SEARCH_MAX = 30;

const STATUSES: readonly AdminProductStatusFilter[] = ['ACTIVE', 'INACTIVE', 'DELETED'];

export interface AdminProductFilters {
  readonly category: ProductCategory;
  /** Không có: đang bán và đã ẩn ("Tất cả") */
  readonly status?: AdminProductStatusFilter;
  readonly q?: string;
  readonly cursor?: string;
  /** Số trang đang xem, bắt đầu từ 1 (chỉ để hiện "Trang N") */
  readonly page: number;
}

/** Đọc bộ lọc từ URL; giá trị lạ thì về mặc định thay vì gọi API rồi nhận 400 */
export function readAdminProductFilters(params: URLSearchParams): AdminProductFilters {
  const rawCategory = params.get('category');
  const category = CATEGORIES.some((c) => c.value === rawCategory)
    ? (rawCategory as ProductCategory)
    : DEFAULT_ADMIN_CATEGORY;
  const rawStatus = params.get('status');
  const status = STATUSES.find((s) => s === rawStatus);
  const q = params.get('q')?.trim().slice(0, ADMIN_SEARCH_MAX) || undefined;
  const cursor = params.get('cursor') || undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  return {
    category,
    ...(status && { status }),
    ...(q && { q }),
    ...(cursor && { cursor }),
    page: cursor ? page : 1,
  };
}

/** Chuỗi query của URL; bỏ giá trị mặc định cho URL gọn. Đổi bộ lọc thì về trang 1 */
export function adminProductsSearch(filters: Partial<AdminProductFilters>): string {
  const params = new URLSearchParams();
  if (filters.category && filters.category !== DEFAULT_ADMIN_CATEGORY) {
    params.set('category', filters.category);
  }
  if (filters.status) params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
  if (filters.cursor) params.set('cursor', filters.cursor);
  if (filters.cursor && filters.page && filters.page > 1) params.set('page', String(filters.page));
  const s = params.toString();
  return s ? `?${s}` : '';
}

/** Query string gửi API `GET /api/v1/admin/products` */
export function adminProductsQuery(filters: AdminProductFilters, limit: number): string {
  const params = new URLSearchParams({ category: filters.category, limit: String(limit) });
  if (filters.status) params.set('status', filters.status);
  if (filters.q) params.set('q', filters.q);
  if (filters.cursor) params.set('cursor', filters.cursor);
  return params.toString();
}
