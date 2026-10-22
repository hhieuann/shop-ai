/**
 * Lọc, sắp xếp và phân trang danh sách sản phẩm (catalog.md BR-01, BR-02, BR-03, BR-08).
 * Chạy trên mảng sản phẩm ACTIVE trong bộ nhớ Lambda (dynamodb-design.md Q4, Q5).
 */
import { InvalidCursorError } from './errors.js';
import { isInStock, isVisibleToCustomers, type Product, type ProductCategory } from './product.js';
import { matchesSearch, type SearchableProduct } from './search.js';

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc'] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

export const DEFAULT_SORT: ProductSort = 'newest';
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

export interface ListingFilter {
  readonly category?: ProductCategory;
  /** Từ khoá đã qua toSearchText; undefined = không tìm */
  readonly needle?: string;
}

/** Chỉ giữ sản phẩm khách được thấy, đúng loại và khớp từ khoá. */
export function filterProducts<T extends SearchableProduct>(
  products: readonly T[],
  filter: ListingFilter,
): T[] {
  return products.filter(
    (p) =>
      isVisibleToCustomers(p) &&
      (filter.category === undefined || p.category === filter.category) &&
      (filter.needle === undefined || matchesSearch(p, filter.needle)),
  );
}

/**
 * Vị trí của một sản phẩm trong thứ tự sắp xếp. Gồm 3 phần, so lần lượt:
 * 1. `group`: 0 = còn hàng, 1 = hết hàng → hết hàng luôn nằm cuối (BR-08)
 * 2. `value`: `createdAt` với newest, `price` với hai cách sắp theo giá
 * 3. `productId`: phân xử khi trùng giá hoặc trùng thời điểm, để thứ tự luôn cố định
 *
 * Bộ ba này cũng là nội dung của cursor: trang sau bắt đầu từ sản phẩm đứng ngay sau nó.
 */
export interface SortPosition {
  readonly group: 0 | 1;
  readonly value: string | number;
  readonly productId: string;
}

export function positionOf(product: Product, sort: ProductSort): SortPosition {
  return {
    group: isInStock(product) ? 0 : 1,
    value: sort === 'newest' ? product.createdAt : product.price,
    productId: product.productId,
  };
}

function compareValues(a: string | number, b: string | number): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Âm: a đứng trước b. Dương: a đứng sau b. */
export function comparePositions(a: SortPosition, b: SortPosition, sort: ProductSort): number {
  if (a.group !== b.group) return a.group - b.group;

  const byValue = compareValues(a.value, b.value);
  if (byValue !== 0) return sort === 'price_asc' ? byValue : -byValue;

  // Cùng giá hoặc cùng thời điểm: newest xếp ULID lớn (mới hơn) trước, sắp theo giá thì ULID nhỏ trước
  const byId = compareValues(a.productId, b.productId);
  return sort === 'newest' ? -byId : byId;
}

export function sortProducts<T extends Product>(products: readonly T[], sort: ProductSort): T[] {
  return products
    .map((product) => ({ product, position: positionOf(product, sort) }))
    .sort((a, b) => comparePositions(a.position, b.position, sort))
    .map(({ product }) => product);
}

// ─── Cursor ────────────────────────────────────────────────────────────────

/** Cursor dài bất thường thì từ chối ngay, không giải mã. */
const MAX_CURSOR_LENGTH = 200;

interface CursorPayload {
  readonly s: ProductSort;
  readonly g: 0 | 1;
  readonly v: string | number;
  readonly id: string;
}

/**
 * Cursor là vị trí của sản phẩm cuối trang, mã hoá base64url để web coi như chuỗi mờ.
 * Không dùng chỉ số mảng: giữa hai lần gọi, cache có thể nạp lại và mảng đổi,
 * còn vị trí theo (nhóm, giá trị, id) thì vẫn đúng.
 */
export function encodeCursor(position: SortPosition, sort: ProductSort): string {
  const payload: CursorPayload = {
    s: sort,
    g: position.group,
    v: position.value,
    id: position.productId,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Cursor sai định dạng, hoặc tạo từ cách sắp xếp khác → InvalidCursorError (API trả 400). */
export function decodeCursor(cursor: string, sort: ProductSort): SortPosition {
  if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) throw new InvalidCursorError();

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidCursorError();
  }

  if (!isCursorPayload(payload) || payload.s !== sort) throw new InvalidCursorError();
  return { group: payload.g, value: payload.v, productId: payload.id };
}

function isCursorPayload(value: unknown): value is CursorPayload {
  if (typeof value !== 'object' || value === null) return false;
  const p = value as Record<string, unknown>;
  const expectedValueType = p.s === 'newest' ? 'string' : 'number';
  return (
    (PRODUCT_SORTS as readonly unknown[]).includes(p.s) &&
    (p.g === 0 || p.g === 1) &&
    typeof p.v === expectedValueType &&
    typeof p.id === 'string' &&
    p.id.length > 0
  );
}

// ─── Phân trang ────────────────────────────────────────────────────────────

export interface Page<T> {
  readonly items: T[];
  /** Có giá trị khi còn trang sau */
  readonly nextCursor?: string;
}

/** `sorted` phải đã qua sortProducts với cùng `sort`. */
export function paginate<T extends Product>(
  sorted: readonly T[],
  options: { readonly sort: ProductSort; readonly limit: number; readonly cursor?: string },
): Page<T> {
  const { sort, limit, cursor } = options;

  let start = 0;
  if (cursor !== undefined) {
    const after = decodeCursor(cursor, sort);
    const index = sorted.findIndex((p) => comparePositions(positionOf(p, sort), after, sort) > 0);
    start = index === -1 ? sorted.length : index;
  }

  const items = sorted.slice(start, start + limit);
  const last = items.at(-1);
  const hasMore = start + limit < sorted.length;

  return hasMore && last
    ? { items, nextCursor: encodeCursor(positionOf(last, sort), sort) }
    : { items };
}
