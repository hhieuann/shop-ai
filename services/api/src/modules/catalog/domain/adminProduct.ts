/**
 * Danh sách sản phẩm cho admin (catalog.md BR-10): một loại mỗi lần, theo nhóm đang bán, đã ẩn,
 * đã xoá mềm; tìm theo tên như BR-03; mới nhất trước theo `productId` (ULID); phân trang cursor.
 * Chạy trên mảng đã đọc hết từ bảng (mỗi loại vài chục món, dynamodb-design.md Q3).
 */
import { InvalidCursorError } from './errors.js';
import type { Page } from './listing.js';
import type { Product, ProductCategory, ProductStatus } from './product.js';
import { matchesSearch, withSearchText } from './search.js';

/** Nhóm của món trong index `byCategory`: khoá `<loại>#ACTIVE`, `<loại>#INACTIVE`, `<loại>#DELETED` */
export const ADMIN_PRODUCT_GROUPS = ['ACTIVE', 'INACTIVE', 'DELETED'] as const;
export type AdminProductGroup = (typeof ADMIN_PRODUCT_GROUPS)[number];

/** Không truyền `status`: đang bán và đã ẩn, không gồm đã xoá (BR-10) */
export const DEFAULT_ADMIN_GROUPS: readonly AdminProductGroup[] = ['ACTIVE', 'INACTIVE'];

export function groupsFor(status: AdminProductGroup | undefined): readonly AdminProductGroup[] {
  return status === undefined ? DEFAULT_ADMIN_GROUPS : [status];
}

/** Số món của một loại theo nhóm, để hiện trên nút lọc; không phụ thuộc `q`, `status` */
export interface AdminProductCounts {
  readonly active: number;
  readonly inactive: number;
  readonly deleted: number;
}

export interface AdminProductPage extends Page<Product> {
  readonly counts: AdminProductCounts;
}

/** Lọc theo từ khoá (đã qua toSearchText) rồi xếp mới nhất trước: ULID lớn hơn là mới hơn */
export function filterAndSortNewest(products: readonly Product[], needle?: string): Product[] {
  const matched =
    needle === undefined
      ? [...products]
      : products.filter((p) => matchesSearch(withSearchText(p), needle));
  return matched.sort((a, b) =>
    a.productId < b.productId ? 1 : a.productId > b.productId ? -1 : 0,
  );
}

// ─── Cursor ────────────────────────────────────────────────────────────────

/** Như cursor của danh sách khách (listing.ts): base64url, quá dài thì từ chối không giải mã */
const MAX_CURSOR_LENGTH = 200;

/** Cursor là `productId` của món cuối trang, kèm đánh dấu để không lẫn với cursor của API khách */
export function encodeAdminCursor(productId: string): string {
  return Buffer.from(JSON.stringify({ a: 1, id: productId })).toString('base64url');
}

/** Sai định dạng hoặc là cursor của API khác → InvalidCursorError (API trả 400) */
export function decodeAdminCursor(cursor: string): string {
  if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) throw new InvalidCursorError();
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursorError();
  }
  if (typeof payload !== 'object' || payload === null) throw new InvalidCursorError();
  const { a, id } = payload as Record<string, unknown>;
  if (a !== 1 || typeof id !== 'string' || id.length === 0) throw new InvalidCursorError();
  return id;
}

/**
 * `sorted` phải đã qua filterAndSortNewest. Trang sau bắt đầu từ món có `productId` nhỏ hơn món
 * cuối trang trước, nên vẫn đúng khi có món mới thêm hoặc món vừa đổi nhóm giữa hai lần gọi.
 */
export function paginateNewest(
  sorted: readonly Product[],
  options: { readonly limit: number; readonly cursor?: string },
): Page<Product> {
  const { limit, cursor } = options;
  let start = 0;
  if (cursor !== undefined) {
    const after = decodeAdminCursor(cursor);
    const index = sorted.findIndex((p) => p.productId < after);
    start = index === -1 ? sorted.length : index;
  }
  const items = sorted.slice(start, start + limit);
  const last = items.at(-1);
  return start + limit < sorted.length && last
    ? { items, nextCursor: encodeAdminCursor(last.productId) }
    : { items };
}

// ─── Ghi (BR-11 … BR-14) ───────────────────────────────────────────────────

/** Nội dung thêm sản phẩm, đã qua kiểm kiểu và độ dài ở handler (chuỗi đã bỏ khoảng trắng hai đầu) */
export interface AdminProductDraft {
  readonly name: string;
  readonly category: ProductCategory;
  readonly brand: string;
  readonly price: number;
  readonly stock: number;
  readonly status: ProductStatus;
  readonly description: string;
  readonly imageUrl?: string;
  readonly specs?: Readonly<Record<string, string>>;
}

/** Các trường admin sửa được (BR-12): mọi trường trừ `category`; `imageUrl: null` là bỏ ảnh */
export interface AdminProductPatch {
  readonly name?: string;
  readonly brand?: string;
  readonly price?: number;
  readonly stock?: number;
  readonly status?: ProductStatus;
  readonly description?: string;
  readonly imageUrl?: string | null;
  readonly specs?: Readonly<Record<string, string>>;
}

/** Sản phẩm mới từ bản nháp: server sinh `productId`, `createdAt` bằng `updatedAt` (BR-11) */
export function newProduct(draft: AdminProductDraft, productId: string, now: string): Product {
  return { ...draft, productId, createdAt: now, updatedAt: now };
}

/** Hành động ghi log (catalog.md mục Log) */
export type AdminProductAction = 'CREATE' | 'UPDATE' | 'HIDE' | 'SHOW';

/** Chỉ đổi trạng thái là ẩn hoặc hiện lại (BR-13); có trường khác thì là sửa */
export function actionOfPatch(patch: AdminProductPatch): AdminProductAction {
  const keys = Object.keys(patch).filter((k) => patch[k as keyof AdminProductPatch] !== undefined);
  if (keys.length === 1 && patch.status !== undefined) {
    return patch.status === 'INACTIVE' ? 'HIDE' : 'SHOW';
  }
  return 'UPDATE';
}
