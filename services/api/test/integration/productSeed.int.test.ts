import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createActiveProducts } from '../../src/modules/catalog/application/activeProducts.js';
import { listProducts } from '../../src/modules/catalog/application/listProducts.js';
import { toSearchText } from '../../src/modules/catalog/domain/search.js';
import { DynamoProductRepository } from '../../src/modules/catalog/infra/dynamoProductRepository.js';
import { parseSeedFile, writeProducts } from '../../src/modules/catalog/infra/productSeed.js';
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
