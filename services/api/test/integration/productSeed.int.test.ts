import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createActiveProducts } from '../../src/modules/catalog/application/activeProducts.js';
import { listProducts } from '../../src/modules/catalog/application/listProducts.js';
import { toSearchText } from '../../src/modules/catalog/domain/search.js';
import { DynamoProductRepository } from '../../src/modules/catalog/infra/dynamoProductRepository.js';
import {
  insertMissingProducts,
  syncProductContent,
  parseSeedFile,
  writeProducts,
} from '../../src/modules/catalog/infra/productSeed.js';
import { productsTableDefinition } from '../helpers/catalog.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const TABLE = 'products-seed-test';
const seed = parseSeedFile(
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, '../../seed/catalog/products.json'), 'utf8'),
  ),
);
let dynamo: DynamoLocal;
let repo: DynamoProductRepository;

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  await dynamo.client.send(new CreateTableCommand(productsTableDefinition(TABLE)));
  repo = new DynamoProductRepository(dynamo.doc, TABLE);
});

afterAll(async () => {
  await dynamo?.stop();
});

describe('writeProducts với file products.json thật', () => {
  it('writeProducts_makesSeedVisibleThroughListApi_andIsIdempotent', async () => {
    // Act: nạp 2 lần liền
    await writeProducts(dynamo.doc, TABLE, seed);
    await writeProducts(dynamo.doc, TABLE, seed);

    // Assert: đọc lại qua đúng đường mà API dùng (GSI byCategory, cache, use case)
    const activeProducts = createActiveProducts({ reader: repo });
    const all = await activeProducts.get();
    const activeInSeed = seed.filter((p) => p.status === 'ACTIVE');
    expect(all).toHaveLength(activeInSeed.length); // không nhân đôi, không lộ hàng ngừng bán

    // Tìm "chuot" không dấu: ra cả chuột (mouse) lẫn "Lót chuột" (accessory), vì tìm theo tên (BR-03)
    const found = await listProducts({ activeProducts }, { q: 'chuot', limit: 50 });
    expect(found.items.length).toBeGreaterThan(0);
    expect(found.items.every((p) => toSearchText(p.name).includes('chuot'))).toBe(true);
    expect(found.items.some((p) => p.category === 'mouse')).toBe(true);

    const gpus = await listProducts({ activeProducts }, { category: 'gpu', sort: 'price_asc' });
    const lastGpu = gpus.items.at(-1);
    expect(lastGpu?.stock).toBe(0); // hàng hết nằm cuối (BR-08)
  });
});

describe('insertMissingProducts (prod)', () => {
  const PROD_TABLE = 'shop-prd-api-ProductsTable-test';

  beforeAll(async () => {
    await dynamo.client.send(new CreateTableCommand(productsTableDefinition(PROD_TABLE)));
  });

  it('insertMissingProducts_insertsAll_whenTableEmpty_evenOnProdTable', async () => {
    // Act: tên bảng prod; writeProducts từ chối, còn hàm này không bao giờ ghi đè nên được phép
    const result = await insertMissingProducts(dynamo.doc, PROD_TABLE, seed);

    // Assert
    expect(result).toEqual({ inserted: seed.length, skipped: 0 });
    const prodRepo = new DynamoProductRepository(dynamo.doc, PROD_TABLE);
    const first = seed[0];
    if (!first) throw new Error('file mẫu phải có sản phẩm');
    expect(await prodRepo.findById(first.productId)).toMatchObject({ name: first.name });
  });

  it('insertMissingProducts_keepsChangedStockAndPrice_whenProductExists', async () => {
    // Arrange: trên prod, đơn hàng đã trừ tồn kho và giá đã đổi sau lần nạp đầu
    const first = seed[0];
    if (!first) throw new Error('file mẫu phải có sản phẩm');
    await dynamo.doc.send(
      new UpdateCommand({
        TableName: PROD_TABLE,
        Key: { productId: first.productId },
        UpdateExpression: 'SET stock = :stock, price = :price',
        ExpressionAttributeValues: { ':stock': 1, ':price': 123_000 },
      }),
    );

    // Act: deploy lại với products.json đã sửa
    const result = await insertMissingProducts(dynamo.doc, PROD_TABLE, seed);

    // Assert: không ghi đè sản phẩm nào
    expect(result).toEqual({ inserted: 0, skipped: seed.length });
    const prodRepo = new DynamoProductRepository(dynamo.doc, PROD_TABLE);
    expect(await prodRepo.findById(first.productId)).toMatchObject({ stock: 1, price: 123_000 });
  });
});

describe('syncProductContent (prod, #527)', () => {
  const SYNC_TABLE = 'shop-prd-api-ProductsTable-sync';

  beforeAll(async () => {
    await dynamo.client.send(new CreateTableCommand(productsTableDefinition(SYNC_TABLE)));
  });

  it('syncProductContent_insertsAll_whenTableEmpty', async () => {
    // Act
    const result = await syncProductContent(dynamo.doc, SYNC_TABLE, seed);

    // Assert
    expect(result).toEqual({ inserted: seed.length, updated: 0, skipped: 0 });
  });

  it('syncProductContent_updatesContent_keepsStockPriceStatus_whenProductExists', async () => {
    // Arrange: đơn hàng đã trừ tồn kho, giá đã đổi, sản phẩm đã ngừng bán trên prod
    const first = seed[0];
    if (!first) throw new Error('file mẫu phải có sản phẩm');
    await dynamo.doc.send(
      new UpdateCommand({
        TableName: SYNC_TABLE,
        Key: { productId: first.productId },
        UpdateExpression: 'SET stock = :stock, price = :price, #status = :status',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: { ':stock': 1, ':price': 123_000, ':status': 'INACTIVE' },
      }),
    );
    const edited = seed.map((p, i) =>
      i === 0
        ? {
            ...p,
            description: 'Mô tả mới, dài hơn.',
            specs: { bao_hanh: '24 tháng' },
            imageUrl: `/products/${p.productId}.webp`,
            price: 999,
            stock: 99,
          }
        : p,
    );

    // Act: deploy lại với products.json đã thêm mô tả, specs, ảnh
    const result = await syncProductContent(dynamo.doc, SYNC_TABLE, edited);

    // Assert: nội dung mới, còn giá, tồn kho, trạng thái giữ như trên prod
    expect(result).toEqual({ inserted: 0, updated: seed.length, skipped: 0 });
    const repo = new DynamoProductRepository(dynamo.doc, SYNC_TABLE);
    expect(await repo.findById(first.productId)).toMatchObject({
      description: 'Mô tả mới, dài hơn.',
      specs: { bao_hanh: '24 tháng' },
      imageUrl: `/products/${first.productId}.webp`,
      stock: 1,
      price: 123_000,
      status: 'INACTIVE',
    });
  });
});

describe('syncProductContent không ghi đè việc admin làm (#554)', () => {
  const ADMIN_TABLE = 'shop-prd-api-ProductsTable-admin';

  beforeAll(async () => {
    await dynamo.client.send(new CreateTableCommand(productsTableDefinition(ADMIN_TABLE)));
    await syncProductContent(dynamo.doc, ADMIN_TABLE, seed);
  });

  it('syncProductContent_skipsEditedAfterFile_andSoftDeleted_updatesTheRest', async () => {
    // Arrange: admin sửa tên món 1 sau ngày trong file, xoá mềm món 2
    const [edited, removed] = seed;
    if (!edited || !removed) throw new Error('file mẫu phải có ít nhất 2 sản phẩm');
    await dynamo.doc.send(
      new UpdateCommand({
        TableName: ADMIN_TABLE,
        Key: { productId: edited.productId },
        UpdateExpression: 'SET #name = :name, updatedAt = :at',
        ExpressionAttributeNames: { '#name': 'name' },
        ExpressionAttributeValues: { ':name': 'Tên admin đặt', ':at': '2099-01-01T00:00:00.000Z' },
      }),
    );
    await dynamo.doc.send(
      new UpdateCommand({
        TableName: ADMIN_TABLE,
        Key: { productId: removed.productId },
        UpdateExpression: 'SET deletedAt = :at',
        ExpressionAttributeValues: { ':at': '2026-11-25T08:00:00.000Z' },
      }),
    );
    const newer = seed.map((p) => ({ ...p, description: 'Mô tả bản deploy mới.' }));

    // Act
    const result = await syncProductContent(dynamo.doc, ADMIN_TABLE, newer);

    // Assert: 2 món bỏ qua, còn lại cập nhật, không lỗi cả lượt
    expect(result).toEqual({ inserted: 0, updated: seed.length - 2, skipped: 2 });
    const products = new DynamoProductRepository(dynamo.doc, ADMIN_TABLE);
    expect(await products.findById(edited.productId)).toMatchObject({ name: 'Tên admin đặt' });
    expect((await products.findById(edited.productId))?.description).not.toBe(
      'Mô tả bản deploy mới.',
    );
    expect(await products.findById(removed.productId)).toMatchObject({
      deletedAt: '2026-11-25T08:00:00.000Z',
    });
    expect((await products.findById(seed[2]?.productId ?? ''))?.description).toBe(
      'Mô tả bản deploy mới.',
    );
  });
});
