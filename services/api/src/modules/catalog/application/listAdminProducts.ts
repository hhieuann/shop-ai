import {
  filterAndSortNewest,
  groupsFor,
  paginateNewest,
  type AdminProductGroup,
  type AdminProductPage,
} from '../domain/adminProduct.js';
import { DEFAULT_PAGE_SIZE } from '../domain/listing.js';
import type { ProductCategory } from '../domain/product.js';
import { toSearchText } from '../domain/search.js';
import type { AdminProductReader } from '../ports.js';

export interface ListAdminProductsDeps {
  readonly reader: AdminProductReader;
}

export interface ListAdminProductsInput {
  readonly category: ProductCategory;
  /** Bỏ trống: đang bán và đã ẩn (BR-10) */
  readonly status?: AdminProductGroup;
  /** Từ khoá chưa chuẩn hoá, 1–30 ký tự (handler đã kiểm) */
  readonly q?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

/**
 * Danh sách sản phẩm cho admin (catalog.md BR-10): đọc các nhóm cần xem và đếm 3 nhóm song song,
 * lọc tên, xếp mới nhất trước, cắt trang. Cursor sai → InvalidCursorError (400).
 */
export async function listAdminProducts(
  deps: ListAdminProductsDeps,
  input: ListAdminProductsInput,
): Promise<AdminProductPage> {
  const { category } = input;
  const [lists, active, inactive, deleted] = await Promise.all([
    Promise.all(groupsFor(input.status).map((group) => deps.reader.listByGroup(category, group))),
    deps.reader.countByGroup(category, 'ACTIVE'),
    deps.reader.countByGroup(category, 'INACTIVE'),
    deps.reader.countByGroup(category, 'DELETED'),
  ]);

  const needle = input.q === undefined ? undefined : toSearchText(input.q);
  const sorted = filterAndSortNewest(lists.flat(), needle || undefined);
  const page = paginateNewest(sorted, {
    limit: input.limit ?? DEFAULT_PAGE_SIZE,
    cursor: input.cursor,
  });
  return { ...page, counts: { active, inactive, deleted } };
}
