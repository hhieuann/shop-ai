/**
 * Use case GET /api/v1/products (catalog.md BR-01 → BR-08).
 * Route đã kiểm input bằng zod (q 1–30 ký tự, category, sort, limit 1–50) trước khi gọi vào đây.
 */
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  filterProducts,
  paginate,
  sortProducts,
  type Page,
  type ProductSort,
} from '../domain/listing.js';
import { toSummary, type ProductCategory, type ProductSummary } from '../domain/product.js';
import { toSearchText } from '../domain/search.js';
import type { ActiveProducts } from './activeProducts.js';

export interface ListProductsDeps {
  readonly activeProducts: ActiveProducts;
}

export interface ListProductsInput {
  readonly category?: ProductCategory;
  readonly q?: string;
  readonly sort?: ProductSort;
  readonly limit?: number;
  readonly cursor?: string;
}

export async function listProducts(
  deps: ListProductsDeps,
  input: ListProductsInput,
): Promise<Page<ProductSummary>> {
  const sort = input.sort ?? DEFAULT_SORT;
  const limit = input.limit ?? DEFAULT_PAGE_SIZE;

  // Từ khoá chỉ có khoảng trắng: chuẩn hoá thành "" thì coi như không tìm, tránh vô tình khớp mọi sản phẩm
  const needle = input.q === undefined ? undefined : toSearchText(input.q) || undefined;

  const products = await deps.activeProducts.get();
  const matched = filterProducts(products, { category: input.category, needle });
  const page = paginate(sortProducts(matched, sort), { sort, limit, cursor: input.cursor });

  const items = page.items.map(toSummary);
  return page.nextCursor === undefined ? { items } : { items, nextCursor: page.nextCursor };
}
