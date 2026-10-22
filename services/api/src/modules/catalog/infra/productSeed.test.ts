import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { uniqueProduct } from '../../../../test/helpers/catalog.js';
import { PRODUCT_CATEGORIES } from '../domain/product.js';
import {
  assertNotProductionTable,
  BATCH_SIZE,
  parseSeedFile,
  SeedFileError,
  writeProducts,
} from './productSeed.js';

/** ULID hợp lệ khác nhau cho test */
const ulid = (n: number) => `01KYXGSD80${String(n).padStart(16, '0')}`;
const products = (count: number) =>
  Array.from({ length: count }, (_, i) => uniqueProduct({ productId: ulid(i + 1) }));

describe('parseSeedFile', () => {
  it('parseSeedFile_returnsProducts_whenFileValid', () => {
    // Arrange
    const file = { _note: 'demo', products: products(2) };

    // Act
    const result = parseSeedFile(file);

    // Assert
    expect(result).toHaveLength(2);
  });

  it.each([
    ['thiếu giá', { price: undefined }, 'products.0.price'],
    ['giá âm', { price: -1 }, 'products.0.price'],
    ['loại lạ', { category: 'peripheral' }, 'products.0.category'],
    ['productId không phải ULID', { productId: 'gpu-1' }, 'products.0.productId'],
    ['trường gõ sai tên', { prcie: 100 }, 'products.0'],
  ])('parseSeedFile_throwsWithPath_when%s', (_label, override, expectedPath) => {
    // Arrange
    const file = { products: [{ ...products(1)[0], ...override }] };

    // Act
    const act = () => parseSeedFile(file);

    // Assert
    expect(act).toThrow(SeedFileError);
    expect(act).toThrow(expectedPath);
  });

  it('parseSeedFile_throws_whenProductIdDuplicated', () => {
    // Arrange
    const [a, b] = products(2);
    const file = { products: [a, { ...b, productId: a!.productId }] };

    // Act
    const act = () => parseSeedFile(file);

    // Assert
    expect(act).toThrow('products.1.productId: trùng với products.0');
  });

  it('parseSeedFile_throws_whenNoProducts', () => {
    // Act + Assert
    expect(() => parseSeedFile({ products: [] })).toThrow(SeedFileError);
  });
});

describe('seed/catalog/products.json', () => {
  // Kiểm chính file dữ liệu demo của dự án, để ai sửa file mà làm hỏng thì CI báo ngay
  const file: unknown = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '../../../../seed/catalog/products.json'), 'utf8'),
  );

  it('productsJson_isValid_andCoversEveryCategory', () => {
    // Act
    const result = parseSeedFile(file);

    // Assert: 80–120 sản phẩm (project-plan.md), mỗi loại ít nhất 5
    expect(result.length).toBeGreaterThanOrEqual(80);
    expect(result.length).toBeLessThanOrEqual(120);
    for (const category of PRODUCT_CATEGORIES) {
      expect(result.filter((p) => p.category === category).length).toBeGreaterThanOrEqual(5);
    }
    // Có hàng hết và hàng ngừng bán để thử BR-04, BR-08
    expect(result.some((p) => p.stock === 0)).toBe(true);
    expect(result.some((p) => p.status === 'INACTIVE')).toBe(true);
  });
});

describe('assertNotProductionTable', () => {
  it.each(['shop-prd-api-ProductsTable123', 'products-prod'])('rejects_%s', (table) => {
    expect(() => assertNotProductionTable(table)).toThrow('prod');
  });

  it('accepts_sandboxAndDevTables', () => {
    expect(() => assertNotProductionTable('shop-sbx-hoang-api-ProductsTable1')).not.toThrow();
    expect(() => assertNotProductionTable('shop-dev-api-ProductsTableABC')).not.toThrow();
  });
});

describe('writeProducts', () => {
  it('writeProducts_sendsBatchesOf25WithCategoryStatus', async () => {
    // Arrange: 30 sản phẩm → 2 lô (25 + 5)
    const send = vi.fn().mockResolvedValue({});
    const db = { send } as never;

    // Act
    const written = await writeProducts(db, 'products-test', products(30));

    // Assert
    expect(written).toBe(30);

    // Verify
    expect(send).toHaveBeenCalledTimes(2);
    const [first, second] = send.mock.calls.map(
      ([command]) => command.input.RequestItems['products-test'],
    );
    expect(first).toHaveLength(BATCH_SIZE);
    expect(second).toHaveLength(5);
    expect(first[0].PutRequest.Item.categoryStatus).toBe('gpu#ACTIVE');
  });

  it('writeProducts_retriesUnprocessedItems_untilAllWritten', async () => {
    // Arrange: lần đầu DynamoDB trả lại 2 item chưa xử lý (throttle)
    const send = vi
      .fn()
      .mockImplementationOnce(async (command) => ({
        UnprocessedItems: {
          'products-test': command.input.RequestItems['products-test'].slice(0, 2),
        },
      }))
      .mockResolvedValue({});
    const sleep = vi.fn().mockResolvedValue(undefined);

    // Act
    await writeProducts({ send } as never, 'products-test', products(3), { sleep });

    // Verify: lần 2 chỉ gửi lại đúng 2 item đó, có chờ trước khi gửi
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0].input.RequestItems['products-test']).toHaveLength(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('writeProducts_throws_whenStillUnprocessedAfterMaxRetries', async () => {
    // Arrange: DynamoDB luôn trả lại item chưa xử lý
    const send = vi.fn(async (command) => ({
      UnprocessedItems: { 'products-test': command.input.RequestItems['products-test'] },
    }));

    // Act
    const act = writeProducts({ send } as never, 'products-test', products(1), {
      maxRetries: 2,
      sleep: async () => {},
    });

    // Assert
    await expect(act).rejects.toThrow('sau 2 lần thử lại');

    // Verify: 1 lần đầu + 2 lần thử lại
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('writeProducts_refusesProductionTable_beforeSending', async () => {
    // Arrange
    const send = vi.fn();

    // Act
    const act = writeProducts({ send } as never, 'shop-prd-api-Products', products(1));

    // Assert
    await expect(act).rejects.toThrow('prod');

    // Verify
    expect(send).not.toHaveBeenCalled();
  });
});
