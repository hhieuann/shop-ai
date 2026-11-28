import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { demoImageSrc, PRODUCT_IMAGE_CREDITS } from './productImages';

const REPO = path.resolve(import.meta.dirname, '../../../../../..');
const seed = JSON.parse(
  readFileSync(path.join(REPO, 'services/api/seed/catalog/products.json'), 'utf8'),
) as { products: { productId: string; name: string; brand: string; category: string }[] };

describe('productImages (#530)', () => {
  it('coversEverySeedProduct_onceEach_withMatchingNameBrandCategory', () => {
    // Assert: đủ 104 món của seed, không thừa, không trùng
    expect(PRODUCT_IMAGE_CREDITS).toHaveLength(seed.products.length);
    expect(new Set(PRODUCT_IMAGE_CREDITS.map((c) => c.productId)).size).toBe(seed.products.length);
    for (const p of seed.products) {
      const c = PRODUCT_IMAGE_CREDITS.find((x) => x.productId === p.productId);
      expect(c, p.name).toMatchObject({ name: p.name, brand: p.brand, category: p.category });
    }
  });

  it('hasOneWebpFilePerProduct_inPublicFolder', () => {
    for (const c of PRODUCT_IMAGE_CREDITS) {
      const file = path.join(REPO, 'apps/web/public/product-images', `${c.productId}.webp`);
      expect(existsSync(file), c.name).toBe(true);
    }
  });

  it('manufacturerPages_areHttpsLinks', () => {
    for (const c of PRODUCT_IMAGE_CREDITS.filter((x) => x.page)) {
      expect(c.page, c.name).toMatch(/^https:\/\//);
    }
  });

  it('demoImageSrc_onlyForKnownProducts', () => {
    const id = PRODUCT_IMAGE_CREDITS[0]!.productId;
    expect(demoImageSrc(id)).toBe(`/product-images/${id}.webp`);
    expect(demoImageSrc('01KAB3Q5G00000000000000001')).toBeUndefined();
  });
});
