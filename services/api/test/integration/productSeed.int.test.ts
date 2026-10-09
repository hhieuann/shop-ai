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
