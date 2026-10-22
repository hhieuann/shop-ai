/**
 * Danh sách sản phẩm ACTIVE giữ trong bộ nhớ Lambda 60 giây (catalog.md "Cách hiện thực tìm kiếm").
 *
 * Tạo một lần ngoài handler (trong lambda.ts) để các request trên cùng một Lambda dùng chung.
 * Hết hạn thì nạp lại: mỗi loại một lần Query, chạy song song.
 */
import { PRODUCT_CATEGORIES } from '../domain/product.js';
import { withSearchText, type SearchableProduct } from '../domain/search.js';
import type { ProductListReader } from '../ports.js';

export const ACTIVE_PRODUCTS_TTL_MS = 60_000;

export interface ActiveProducts {
  get(): Promise<readonly SearchableProduct[]>;
}

export interface ActiveProductsDeps {
  readonly reader: ProductListReader;
  readonly ttlMs?: number;
  /** Đồng hồ, truyền vào để test chỉnh được thời gian */
  readonly now?: () => number;
}

export function createActiveProducts(deps: ActiveProductsDeps): ActiveProducts {
  const { reader, ttlMs = ACTIVE_PRODUCTS_TTL_MS, now = Date.now } = deps;

  let cached:
    { readonly products: readonly SearchableProduct[]; readonly expiresAt: number } | undefined;
  // Nhiều request tới cùng lúc khi cache hết hạn thì chỉ nạp một lần
  let loading: Promise<readonly SearchableProduct[]> | undefined;

  async function load(): Promise<readonly SearchableProduct[]> {
    const perCategory = await Promise.all(
      PRODUCT_CATEGORIES.map((category) => reader.listActiveByCategory(category)),
    );
    // Chuẩn hoá tên một lần ở đây, không phải ở mỗi lần tìm
    const products = perCategory.flat().map(withSearchText);
    cached = { products, expiresAt: now() + ttlMs };
    return products;
  }

  return {
    get() {
      if (cached && now() < cached.expiresAt) return Promise.resolve(cached.products);

      // Nạp lỗi thì không lưu gì, request sau thử lại
      loading ??= load().finally(() => {
        loading = undefined;
      });
      return loading;
    },
  };
}
