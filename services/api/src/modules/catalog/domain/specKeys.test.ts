import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PRODUCT_CATEGORIES } from './product.js';
import { SPEC_KEYS, unknownSpecKeys } from './specKeys.js';

/** 104 món demo: bảng khoá chép từ web phải phủ hết khoá đang có trong seed */
const seed = JSON.parse(
  readFileSync(path.join(import.meta.dirname, '../../../../seed/catalog/products.json'), 'utf8'),
) as { products: { category: (typeof PRODUCT_CATEGORIES)[number]; specs?: object }[] };

describe('SPEC_KEYS', () => {
  it('hasEntryForEveryCategory', () => {
    // Assert
    expect(Object.keys(SPEC_KEYS).sort()).toEqual([...PRODUCT_CATEGORIES].sort());
  });

  it.each(PRODUCT_CATEGORIES)('coversEverySeedSpecKey_of_%s', (category) => {
    // Arrange
    const used = new Set(
      seed.products
        .filter((p) => p.category === category)
        .flatMap((p) => Object.keys(p.specs ?? {})),
    );

    // Assert: khoá trong seed đều nằm trong bảng; bảng không có khoá thừa so với seed
    expect([...used].sort()).toEqual([...SPEC_KEYS[category]].sort());
  });
});

describe('unknownSpecKeys', () => {
  it('unknownSpecKeys_returnsEmpty_whenAllKeysBelongToCategory', () => {
    // Act
    const result = unknownSpecKeys('gpu', { vram: '8GB', nguon_de_xuat: '550W' });

    // Assert
    expect(result).toEqual([]);
  });

  it('unknownSpecKeys_returnsKeysOfOtherCategories', () => {
    // Act
    const result = unknownSpecKeys('gpu', { vram: '8GB', dpi: '26000', socket: 'AM5' });

    // Assert
    expect(result).toEqual(['dpi', 'socket']);
  });
});
