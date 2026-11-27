import { describe, expect, it } from 'vitest';
import type { AdminProduct } from '../../../shared/api/types';
import {
  copyFrom,
  emptyForm,
  formatAmount,
  fromProduct,
  parseAmount,
  toCreateBody,
  toPatchBody,
  validateProduct,
  type ProductFormValues,
} from './productForm';

const PRODUCT: AdminProduct = {
  productId: '01J9XKPQ0000000000000001',
  name: 'Card MSI RTX 4060 Ventus 2X 8GB',
  category: 'gpu',
  brand: 'MSI',
  price: 8_290_000,
  stock: 12,
  status: 'ACTIVE',
  description: 'Card tầm trung.',
  imageUrl: 'https://example.com/rtx4060.webp',
  specs: { vram: '8GB GDDR6', nguon_de_xuat: '550W' },
  createdAt: '2026-10-01T07:00:00.000Z',
  updatedAt: '2026-11-20T03:15:00.000Z',
};

const valid = (overrides: Partial<ProductFormValues> = {}): ProductFormValues => ({
  ...emptyForm('gpu'),
  name: 'Card MSI RTX 4060',
  brand: 'MSI',
  price: '8.290.000',
  stock: '5',
  description: 'Card tầm trung.',
  ...overrides,
});

describe('parseAmount, formatAmount', () => {
  it.each([
    ['8.290.000', 8_290_000],
    ['8 290 000', 8_290_000],
    ['0', 0],
    ['abc', Number.NaN],
    ['-5', Number.NaN],
    ['1500000', 1_500_000],
    ['1.500.000', 1_500_000],
    ['1,500,000', 1_500_000],
    ['1 500 000', 1_500_000],
    // Có phần thập phân hoặc nhóm không đủ 3 chữ số: báo lỗi, không tự thành số khác (review #559)
    ['1.5', Number.NaN],
    ['1,5', Number.NaN],
    ['1.50', Number.NaN],
    ['1.5000', Number.NaN],
  ])('parseAmount(%s)', (text, expected) => {
    expect(parseAmount(text)).toBe(expected);
  });

  it('formatAmount_addsThousandDots_orKeepsInvalidText', () => {
    expect(formatAmount('8290000')).toBe('8.290.000');
    expect(formatAmount('abc')).toBe('abc');
  });
});

describe('validateProduct (catalog.md BR-11)', () => {
  it('returnsNoErrors_forValidForm', () => {
    expect(validateProduct(valid())).toEqual({});
  });

  it.each<[string, Partial<ProductFormValues>, string]>([
    ['tên trống', { name: '   ' }, 'name'],
    ['tên quá 150', { name: 'a'.repeat(151) }, 'name'],
    ['hãng quá 50', { brand: 'a'.repeat(51) }, 'brand'],
    ['mô tả trống', { description: '' }, 'description'],
    ['giá trống', { price: '' }, 'price'],
    ['giá 0', { price: '0' }, 'price'],
    ['giá quá 1 tỷ', { price: '1000000001' }, 'price'],
    ['giá chữ', { price: 'tám triệu' }, 'price'],
    ['tồn kho trống', { stock: '' }, 'stock'],
    ['tồn kho quá 9999', { stock: '10000' }, 'stock'],
    ['ảnh http', { imageUrl: 'http://example.com/a.png' }, 'imageUrl'],
    ['thông số quá 100', { specs: { vram: 'a'.repeat(101) } }, 'specs.vram'],
  ])('flags_%s', (_name, overrides, field) => {
    expect(validateProduct(valid(overrides))).toHaveProperty(field);
  });
});

describe('toCreateBody', () => {
  it('trimsAndParses_dropsEmptySpecsAndImage', () => {
    // Arrange
    const values = valid({
      name: '  Card MSI RTX 4060 ',
      active: false,
      specs: { ...emptyForm('gpu').specs, vram: ' 8GB GDDR6 ' },
    });

    // Act
    const body = toCreateBody('gpu', values);

    // Assert
    expect(body).toEqual({
      name: 'Card MSI RTX 4060',
      category: 'gpu',
      brand: 'MSI',
      price: 8_290_000,
      stock: 5,
      status: 'INACTIVE',
      description: 'Card tầm trung.',
      specs: { vram: '8GB GDDR6' },
    });
  });
});

describe('toPatchBody (catalog.md BR-12)', () => {
  it('returnsNull_whenNothingChanged', () => {
    expect(toPatchBody(PRODUCT, fromProduct(PRODUCT))).toBeNull();
  });

  it('sendsOnlyChangedFields_withUpdatedAt', () => {
    // Act
    const body = toPatchBody(PRODUCT, { ...fromProduct(PRODUCT), price: '7.990.000' });

    // Assert
    expect(body).toEqual({ updatedAt: PRODUCT.updatedAt, price: 7_990_000 });
  });

  it('sendsExpectedStock_whenStockChanges', () => {
    expect(toPatchBody(PRODUCT, { ...fromProduct(PRODUCT), stock: '20' })).toEqual({
      updatedAt: PRODUCT.updatedAt,
      stock: 20,
      expectedStock: 12,
    });
  });

  it('sendsNullImage_whenImageCleared_andStatusWhenSwitchedOff', () => {
    expect(toPatchBody(PRODUCT, { ...fromProduct(PRODUCT), imageUrl: ' ', active: false })).toEqual(
      { updatedAt: PRODUCT.updatedAt, imageUrl: null, status: 'INACTIVE' },
    );
  });

  it('sendsWholeSpecMap_withoutEmptyKeys_whenAnySpecChanges', () => {
    // Arrange: sửa VRAM, xoá trống "Nguồn đề xuất"
    const values = fromProduct(PRODUCT);
    const specs = { ...values.specs, vram: '8GB GDDR6 (bản OC)', nguon_de_xuat: '' };

    // Act
    const body = toPatchBody(PRODUCT, { ...values, specs });

    // Assert
    expect(body).toEqual({ updatedAt: PRODUCT.updatedAt, specs: { vram: '8GB GDDR6 (bản OC)' } });
  });
});

describe('thông số lạ của dữ liệu cũ (review #559)', () => {
  it('toPatchBody_dropsSpecKeysNotInSpecOrder', () => {
    // Arrange: món cũ có khoá không thuộc SPEC_ORDER của gpu
    const old = { ...PRODUCT, specs: { ...PRODUCT.specs, khoa_cu: 'x' } };
    const values = {
      ...fromProduct(old),
      specs: { ...fromProduct(old).specs, vram: '16GB GDDR6' },
    };

    // Act
    const body = toPatchBody(old, values);

    // Assert: gửi cả bảng thông số, không có khoá lạ
    expect(body?.specs).toEqual({ vram: '16GB GDDR6', nguon_de_xuat: '550W' });
  });

  it('toCreateBody_dropsSpecKeysNotInSpecOrder', () => {
    // Act
    const body = toCreateBody('gpu', valid({ specs: { vram: '8GB GDDR6', khoa_cu: 'x' } }));

    // Assert
    expect(body.specs).toEqual({ vram: '8GB GDDR6' });
  });
});

describe('copyFrom', () => {
  it('keepsEverythingButNamePriceStockImage', () => {
    // Act
    const values = copyFrom(PRODUCT);

    // Assert
    expect(values).toMatchObject({ name: '', price: '', stock: '', imageUrl: '', brand: 'MSI' });
    expect(values.description).toBe(PRODUCT.description);
    expect(values.specs).toMatchObject(PRODUCT.specs ?? {});
  });
});
