/**
 * Luật thuần của module recommendation (recommendation.md, hợp đồng #213, chốt với Nhân 22/10/2026).
 * Không gọi AWS: chỉ chọn sản phẩm nào được hiện từ danh sách ứng viên pipeline đã xếp hạng.
 */

/** Loại gợi ý trong bảng `recs`: `pk = <RecType>#<anchor>`, con trỏ `META / ACTIVE#<RecType>` */
export type RecType = 'FOR_YOU' | 'ALSO_BOUGHT' | 'BESTSELLER';

/** Nguồn của cả danh sách trả ra (RecsSource trong contracts/openapi.yaml), để web chọn tiêu đề */
export type RecsSource = 'PERSONALIZED' | 'ALSO_BOUGHT' | 'BESTSELLER';

/** Anchor của hàng bán chạy mọi loại; hàng bán chạy theo loại dùng chính tên category */
export const ALL_CATEGORIES = 'ALL';

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
 * Pipeline ghi 20 dòng mỗi anchor để lọc xong vẫn đủ 10.
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
