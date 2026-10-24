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

interface Ranked {
  readonly ids: string[];
  /** Nguồn khi danh sách này là hàng bán chạy: `NEWEST` nếu pipeline xếp theo hàng mới */
  readonly bestsellerSource: RecsSource;
}

/** Đọc dòng gợi ý của anchor trong phiên bản đang bật; rỗng khi pipeline chưa chạy */
async function ranked(deps: RecsDeps, recType: RecType, anchor: string): Promise<Ranked> {
  const pointer = await deps.recs.activePointer(recType);
  if (pointer === null) return { ids: [], bestsellerSource: 'BESTSELLER' };
  return {
    ids: await deps.recs.rankedProductIds(recType, anchor, pointer.version),
    bestsellerSource: pointer.basis === 'NEWEST' ? 'NEWEST' : 'BESTSELLER',
  };
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
  const { ids, bestsellerSource } = await ranked(
    deps,
    'BESTSELLER',
    input.category ?? ALL_CATEGORIES,
  );
  return toResult(deps, bestsellerSource, ids, new Set(input.exclude), input.limit);
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
  const { ids } = await ranked(deps, 'ALSO_BOUGHT', input.productId);
  if (ids.length > 0) return toResult(deps, 'ALSO_BOUGHT', ids, exclude, input.limit);

  const anchor = (await deps.catalog.findMany([input.productId])).get(input.productId);
  const fallback = await ranked(deps, 'BESTSELLER', anchor?.category ?? ALL_CATEGORIES);
  return toResult(deps, fallback.bestsellerSource, fallback.ids, exclude, input.limit);
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
  const { ids } = await ranked(deps, 'FOR_YOU', await deps.hasher.hash(input.userId));
  if (ids.length > 0) return toResult(deps, 'PERSONALIZED', ids, exclude, input.limit);

  const fallback = await ranked(deps, 'BESTSELLER', ALL_CATEGORIES);
  return toResult(deps, fallback.bestsellerSource, fallback.ids, exclude, input.limit);
}
