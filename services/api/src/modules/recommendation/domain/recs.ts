/**
 * Luật thuần của module recommendation (recommendation.md, hợp đồng #213, chốt với Nhân 22/10/2026).
 * Không gọi AWS: chỉ chọn sản phẩm nào được hiện từ danh sách ứng viên pipeline đã xếp hạng.
 */

/** Loại gợi ý trong bảng `recs`: `pk = <RecType>#<anchor>`, con trỏ `META / ACTIVE#<RecType>` */
export type RecType = 'FOR_YOU' | 'ALSO_BOUGHT' | 'BESTSELLER';

/**
 * Nguồn của cả danh sách trả ra (RecsSource trong contracts/openapi.yaml), để web chọn tiêu đề.
 * `NEWEST`: danh sách hàng bán chạy nhưng pipeline không đủ đơn nên xếp theo hàng mới (chốt với Nhân 22/10).
 */
export type RecsSource = 'PERSONALIZED' | 'ALSO_BOUGHT' | 'BESTSELLER' | 'NEWEST';

/**
 * Cột `basis` của con trỏ `ACTIVE#BESTSELLER`: pipeline đếm đơn trong 30, 90, 365 ngày, đơn quá ít
 * thì xếp theo hàng mới (`NEWEST`).
 */
export type BestsellerBasis = 'PURCHASES_30D' | 'PURCHASES_90D' | 'PURCHASES_365D' | 'NEWEST';

/** Con trỏ `META / ACTIVE#<RecType>`: phiên bản đang bật; `basis` chỉ có ở BESTSELLER */
export interface RecsPointer {
  readonly version: number;
  readonly basis?: BestsellerBasis;
}

/** Anchor của hàng bán chạy mọi loại; hàng bán chạy theo loại dùng chính tên category */
export const ALL_CATEGORIES = 'ALL';

/**
 * 13 loại hàng, khớp enum ProductCategory trong contracts/openapi.yaml. Chép từ catalog vì module
 * không import nhau (ADR-0009); catalog đổi loại thì sửa cả ở đây.
 */
export const REC_CATEGORIES = [
  'laptop',
  'cpu',
  'gpu',
  'ram',
  'storage',
  'mainboard',
  'psu',
  'cooling',
  'keyboard',
  'mouse',
  'monitor',
  'headset',
  'accessory',
] as const;

/** Số món tối đa một lần gọi (RecsLimit) và số mã tối đa trong `exclude` (RecsExclude) */
export const MAX_LIMIT = 10;
export const DEFAULT_LIMIT = 6;
export const MAX_EXCLUDE = 20;

/** Thông tin sản phẩm trả ra API (ProductSummary trong contracts/openapi.yaml) */
export interface RecProduct {
  readonly productId: string;
  readonly name: string;
  readonly category: string;
  readonly brand: string;
  readonly price: number;
  readonly stock: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
  readonly imageUrl?: string;
  readonly specs?: Readonly<Record<string, unknown>>;
}

export interface RecsResult {
  readonly source: RecsSource;
  readonly items: readonly RecProduct[];
}

/**
 * Giữ thứ hạng của pipeline, bỏ: sản phẩm không còn trong catalog, `INACTIVE`, hết hàng,
 * mã trong `exclude` (hàng đã trong giỏ) và mã trùng; lấy tối đa `limit` món.
 * Pipeline ghi nhiều dòng hơn `limit` mỗi anchor để lọc xong vẫn đủ món.
 */
export function pickRecommendations(
  rankedIds: readonly string[],
  products: ReadonlyMap<string, RecProduct>,
  exclude: ReadonlySet<string>,
  limit: number,
): RecProduct[] {
  const picked: RecProduct[] = [];
  const seen = new Set<string>();
  for (const id of rankedIds) {
    if (picked.length >= limit) break;
    if (seen.has(id) || exclude.has(id)) continue;
    seen.add(id);
    const product = products.get(id);
    if (product?.status !== 'ACTIVE' || product.stock <= 0) continue;
    picked.push(product);
  }
  return picked;
}
