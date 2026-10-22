import {
  ALL_CATEGORIES,
  pickRecommendations,
  type RecsResult,
  type RecsSource,
  type RecType,
} from '../domain/recs.js';
import type { ProductCatalog, RecsStore, UserIdHasher } from '../ports.js';

export interface RecsDeps {
  readonly recs: RecsStore;
  readonly catalog: ProductCatalog;
  readonly hasher: UserIdHasher;
}

/** Tham số chung của 3 route; handler đã kiểm `limit` 1–10 và `exclude` tối đa 20 mã */
export interface ListOptions {
  readonly exclude: readonly string[];
  readonly limit: number;
}

/** Đọc dòng gợi ý của anchor trong phiên bản đang bật; rỗng khi pipeline chưa chạy */
async function rankedIds(deps: RecsDeps, recType: RecType, anchor: string): Promise<string[]> {
  const version = await deps.recs.activeVersion(recType);
  return version === null ? [] : deps.recs.rankedProductIds(recType, anchor, version);
}

/** Lấy sản phẩm của các mã ứng viên rồi lọc theo luật domain */
async function toResult(
  deps: RecsDeps,
  source: RecsSource,
  ids: readonly string[],
  exclude: ReadonlySet<string>,
  limit: number,
): Promise<RecsResult> {
  const products = await deps.catalog.findMany(ids);
  return { source, items: pickRecommendations(ids, products, exclude, limit) };
}

/** GET /api/v1/recs/bestsellers: hàng bán chạy mọi loại, hoặc của một loại khi có `category` */
export async function getBestsellers(
  deps: RecsDeps,
  input: ListOptions & { readonly category?: string },
): Promise<RecsResult> {
  const ids = await rankedIds(deps, 'BESTSELLER', input.category ?? ALL_CATEGORIES);
  return toResult(deps, 'BESTSELLER', ids, new Set(input.exclude), input.limit);
}

/**
 * GET /api/v1/recs/also-bought: thường mua kèm `productId`. Sản phẩm chưa có dòng nào (mới, ít người
 * mua) thì trả hàng bán chạy cùng loại; không còn trong catalog thì hàng bán chạy mọi loại (ADR-0016).
 */
export async function getAlsoBought(
  deps: RecsDeps,
  input: ListOptions & { readonly productId: string },
): Promise<RecsResult> {
  // Không gợi ý lại chính sản phẩm đang xem
  const exclude = new Set([...input.exclude, input.productId]);
  const ids = await rankedIds(deps, 'ALSO_BOUGHT', input.productId);
  if (ids.length > 0) return toResult(deps, 'ALSO_BOUGHT', ids, exclude, input.limit);

  const anchor = (await deps.catalog.findMany([input.productId])).get(input.productId);
  const fallback = await rankedIds(deps, 'BESTSELLER', anchor?.category ?? ALL_CATEGORIES);
  return toResult(deps, 'BESTSELLER', fallback, exclude, input.limit);
}

/**
 * GET /api/v1/recs/for-you: gợi ý theo lịch sử của người đang đăng nhập (`FOR_YOU#<userIdHash>`).
 * Người chưa có lịch sử thì trả hàng bán chạy mọi loại (ADR-0016).
 */
export async function getForYou(
  deps: RecsDeps,
  input: ListOptions & { readonly userId: string },
): Promise<RecsResult> {
  const exclude = new Set(input.exclude);
  const ids = await rankedIds(deps, 'FOR_YOU', await deps.hasher.hash(input.userId));
  if (ids.length > 0) return toResult(deps, 'PERSONALIZED', ids, exclude, input.limit);

  const fallback = await rankedIds(deps, 'BESTSELLER', ALL_CATEGORIES);
  return toResult(deps, 'BESTSELLER', fallback, exclude, input.limit);
}
