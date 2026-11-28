import { describe, expect, it } from 'vitest';
import { SPEC_ORDER } from '../../catalog/lib/specLabels';
import { CATEGORIES } from '../../catalog/lib/productFilters';
import { PRODUCT_TEMPLATES } from './productTemplates';
import { fromTemplate } from './productForm';

describe('PRODUCT_TEMPLATES (pages/admin-san-pham.md mục 4)', () => {
  it('hasOneTemplatePerCategory', () => {
    expect(Object.keys(PRODUCT_TEMPLATES).sort()).toEqual(CATEGORIES.map((c) => c.value).sort());
  });

  it.each(CATEGORIES.map((c) => c.value))(
    '%s_coversSpecOrderExactly_withNonEmptyValues',
    (category) => {
      // Arrange
      const template = PRODUCT_TEMPLATES[category];

      // Assert: đủ ô thông số theo SPEC_ORDER, không khoá lạ (API từ chối khoá lạ, BR-11)
      expect(Object.keys(template.specs).sort()).toEqual([...SPEC_ORDER[category]].sort());
      for (const value of Object.values(template.specs)) {
        expect(value.trim().length).toBeGreaterThan(0);
        expect(value.length).toBeLessThanOrEqual(100);
      }
      expect(template.brand.length).toBeLessThanOrEqual(50);
      expect(template.description.length).toBeLessThanOrEqual(1000);
    },
  );

  it.each(CATEGORIES.map((c) => c.value))('%s_fillsFormWithoutNamePriceStockImage', (category) => {
    // Act
    const values = fromTemplate(category);

    // Assert: tên, giá, tồn kho, ảnh để trống cho admin nhập
    expect(values).toMatchObject({ name: '', price: '', stock: '', imageUrl: '', active: true });
    expect(values.brand).toBe(PRODUCT_TEMPLATES[category].brand);
  });
});
