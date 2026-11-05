import { describe, expect, it } from 'vitest';
import type { BestsellerBasis, RecProduct, RecsPointer, RecType } from '../domain/recs.js';
import type { ProductCatalog, RecsStore, UserIdHasher } from '../ports.js';
import { getAlsoBought, getBestsellers, getForYou, type RecsDeps } from './getRecs.js';

const VERSION = 20261027;

function product(productId: string, category = 'gpu'): RecProduct {
  return {
    productId,
    name: `Sản phẩm ${productId}`,
    category,
    brand: 'ASUS',
    price: 1_000_000,
    stock: 5,
    status: 'ACTIVE',
  };
}

/** Bảng recs giả: con trỏ theo loại, dòng gợi ý theo `<loại>#<anchor>` của đúng phiên bản */
class FakeRecs implements RecsStore {
  readonly pointers = new Map<RecType, RecsPointer>();
  readonly rows = new Map<string, string[]>();

  set(recType: RecType, anchor: string, ids: string[]): this {
    if (!this.pointers.has(recType)) this.pointers.set(recType, { version: VERSION });
    this.rows.set(`${recType}#${anchor}#${VERSION}`, ids);
    return this;
  }

  /** Cột `basis` của con trỏ ACTIVE#BESTSELLER */
  basis(basis: BestsellerBasis): this {
    this.pointers.set('BESTSELLER', { version: VERSION, basis });
    return this;
  }

  async activePointer(recType: RecType): Promise<RecsPointer | null> {
    return this.pointers.get(recType) ?? null;
  }

  async rankedProductIds(recType: RecType, anchor: string, version: number): Promise<string[]> {
    return this.rows.get(`${recType}#${anchor}#${version}`) ?? [];
  }
}

class FakeCatalog implements ProductCatalog {
  private readonly products: Map<string, RecProduct>;

  constructor(...products: RecProduct[]) {
    this.products = new Map(products.map((p) => [p.productId, p]));
  }

  async findMany(productIds: readonly string[]): Promise<Map<string, RecProduct>> {
    return new Map(
      productIds.flatMap((id) => {
        const found = this.products.get(id);
        return found ? [[id, found] as const] : [];
      }),
    );
  }
}

/** Băm giả có thể đoán trước, để test biết use case đọc đúng anchor FOR_YOU */
const hasher: UserIdHasher = { hash: async (userId) => `hash-of-${userId}` };

function deps(recs: FakeRecs, catalog: FakeCatalog): RecsDeps {
  return { recs, catalog, hasher };
}

const noFilter = { exclude: [], limit: 10 };

describe('getAlsoBought', () => {
  it('returnsActiveRowsOfProduct_withoutTheProductItself', async () => {
    // Arrange
    const recs = new FakeRecs().set('ALSO_BOUGHT', 'gpu-1', ['psu-1', 'gpu-1', 'fan-1']);
    const catalog = new FakeCatalog(product('gpu-1'), product('psu-1'), product('fan-1'));

    // Act
    const result = await getAlsoBought(deps(recs, catalog), { ...noFilter, productId: 'gpu-1' });

    // Assert
    expect(result.source).toBe('ALSO_BOUGHT');
    expect(result.items.map((p) => p.productId)).toEqual(['psu-1', 'fan-1']);
  });

  it('fallsBackToSameCategoryBestsellers_whenProductHasNoRows', async () => {
    // Arrange: sản phẩm mới, pipeline chưa có dòng ALSO_BOUGHT nào
    const recs = new FakeRecs()
      .set('ALSO_BOUGHT', 'other', ['x'])
      .set('BESTSELLER', 'gpu', ['gpu-2', 'gpu-new'])
      .set('BESTSELLER', 'ALL', ['ram-1']);
    const catalog = new FakeCatalog(product('gpu-new'), product('gpu-2'), product('ram-1', 'ram'));

    // Act
    const result = await getAlsoBought(deps(recs, catalog), { ...noFilter, productId: 'gpu-new' });

    // Assert
    expect(result.source).toBe('BESTSELLER');
    expect(result.items.map((p) => p.productId)).toEqual(['gpu-2']);
  });

  it('fallsBackToAllBestsellers_whenProductIsNotInCatalog', async () => {
    // Arrange
    const recs = new FakeRecs().set('BESTSELLER', 'ALL', ['ram-1']);
    const catalog = new FakeCatalog(product('ram-1', 'ram'));

    // Act
    const result = await getAlsoBought(deps(recs, catalog), { ...noFilter, productId: 'gone' });

    // Assert
    expect(result.source).toBe('BESTSELLER');
    expect(result.items.map((p) => p.productId)).toEqual(['ram-1']);
  });

  it('dropsExcludedCartItems_andRespectsLimit', async () => {
    // Arrange
    const recs = new FakeRecs().set('ALSO_BOUGHT', 'gpu-1', ['a', 'b', 'c', 'd']);
    const catalog = new FakeCatalog(product('a'), product('b'), product('c'), product('d'));

    // Act
    const result = await getAlsoBought(deps(recs, catalog), {
      productId: 'gpu-1',
      exclude: ['b'],
      limit: 2,
    });

    // Assert
    expect(result.items.map((p) => p.productId)).toEqual(['a', 'c']);
  });
});

describe('getForYou', () => {
  it('readsRowsOfHashedUserId', async () => {
    // Arrange: dòng FOR_YOU nằm dưới userIdHash, không phải userId thật (events.md mục 2)
    const recs = new FakeRecs().set('FOR_YOU', 'hash-of-user-1', ['a', 'b']);
    const catalog = new FakeCatalog(product('a'), product('b'));

    // Act
    const result = await getForYou(deps(recs, catalog), { ...noFilter, userId: 'user-1' });

    // Assert
    expect(result.source).toBe('PERSONALIZED');
    expect(result.items.map((p) => p.productId)).toEqual(['a', 'b']);
  });

  it('fallsBackToAllBestsellers_whenUserHasNoHistory', async () => {
    // Arrange
    const recs = new FakeRecs()
      .set('FOR_YOU', 'hash-of-someone-else', ['a'])
      .set('BESTSELLER', 'ALL', ['b']);
    const catalog = new FakeCatalog(product('a'), product('b'));

    // Act
    const result = await getForYou(deps(recs, catalog), { ...noFilter, userId: 'new-user' });

    // Assert
    expect(result.source).toBe('BESTSELLER');
    expect(result.items.map((p) => p.productId)).toEqual(['b']);
  });

  it('fallsBackWithNewestSource_whenBestsellersRankedByNewest', async () => {
    // Arrange
    const recs = new FakeRecs().set('BESTSELLER', 'ALL', ['b']).basis('NEWEST');
    const catalog = new FakeCatalog(product('b'));

    // Act
    const result = await getForYou(deps(recs, catalog), { ...noFilter, userId: 'new-user' });

    // Assert
    expect(result.source).toBe('NEWEST');
  });
});

describe('getBestsellers', () => {
  it('readsCategoryAnchor_whenCategoryGiven', async () => {
    // Arrange
    const recs = new FakeRecs()
      .set('BESTSELLER', 'ALL', ['ram-1'])
      .set('BESTSELLER', 'gpu', ['gpu-1']);
    const catalog = new FakeCatalog(product('ram-1', 'ram'), product('gpu-1'));

    // Act
    const byCategory = await getBestsellers(deps(recs, catalog), { ...noFilter, category: 'gpu' });
    const all = await getBestsellers(deps(recs, catalog), noFilter);

    // Assert
    expect(byCategory.items.map((p) => p.productId)).toEqual(['gpu-1']);
    expect(all.items.map((p) => p.productId)).toEqual(['ram-1']);
  });

  it('returnsEmptyList_whenPipelineHasNeverRun', async () => {
    // Arrange: chưa có con trỏ nào; web ẩn widget khi danh sách rỗng
    const recs = new FakeRecs();
    const catalog = new FakeCatalog(product('a'));

    // Act
    const result = await getBestsellers(deps(recs, catalog), noFilter);

    // Assert
    expect(result).toEqual({ source: 'BESTSELLER', items: [] });
  });

  it('returnsNewestSource_whenPipelineRankedByNewestProducts', async () => {
    // Arrange: prod ít đơn, pipeline xếp theo hàng mới (chốt với Nhân 22/10); web đổi tiêu đề widget
    const recs = new FakeRecs().set('BESTSELLER', 'ALL', ['a']).basis('NEWEST');
    const catalog = new FakeCatalog(product('a'));

    // Act
    const result = await getBestsellers(deps(recs, catalog), noFilter);

    // Assert
    expect(result.source).toBe('NEWEST');
    expect(result.items.map((p) => p.productId)).toEqual(['a']);
  });

  it('keepsBestsellerSource_whenBasisIsPurchases', async () => {
    // Arrange
    const recs = new FakeRecs().set('BESTSELLER', 'ALL', ['a']).basis('PURCHASES_90D');
    const catalog = new FakeCatalog(product('a'));

    // Act
    const result = await getBestsellers(deps(recs, catalog), noFilter);

    // Assert
    expect(result.source).toBe('BESTSELLER');
  });
});
