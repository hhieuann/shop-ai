import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { makeAdminProductHandler } from './adminHandler.js';
import { createAdminProduct } from './application/createAdminProduct.js';
import { deleteAdminProduct } from './application/deleteAdminProduct.js';
import { getAdminProduct } from './application/getAdminProduct.js';
import { listAdminProducts } from './application/listAdminProducts.js';
import { restoreAdminProduct } from './application/restoreAdminProduct.js';
import { updateAdminProduct } from './application/updateAdminProduct.js';
import { DynamoAdminProductReader } from './infra/dynamoAdminProductReader.js';
import { DynamoAdminProductWriter } from './infra/dynamoAdminProductWriter.js';
import { DynamoProductRepository } from './infra/dynamoProductRepository.js';

// Lambda riêng của API admin sản phẩm (catalog.md BR-09 … BR-15), tách khỏi Lambda catalog công khai
// (chỉ đọc món ACTIVE). Hạ tầng (#546) trỏ Lambda CatalogAdminFunction vào file này. Không cache
// danh sách trong bộ nhớ như API khách: admin cần thấy ngay món vừa sửa.
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const table = requiredEnv('PRODUCTS_TABLE');
const products = new DynamoProductRepository(db, table);
const reader = new DynamoAdminProductReader(db, table);
const writer = new DynamoAdminProductWriter(db, table);
const now = () => new Date().toISOString();

export const handler = withTracing(
  makeAdminProductHandler({
    listAdminProducts: (input) => listAdminProducts({ reader }, input),
    getAdminProduct: (input) => getAdminProduct({ products }, input),
    // Không bọc idempotency: bấm lưu hai lần có thể tạo hai món, web khoá nút (catalog.md giới hạn)
    createAdminProduct: (input) => createAdminProduct({ writer, newId: ulid, now }, input),
    updateAdminProduct: (input) => updateAdminProduct({ products, writer, now }, input),
    deleteAdminProduct: (input) => deleteAdminProduct({ products, writer, now }, input),
    restoreAdminProduct: (input) => restoreAdminProduct({ products, writer, now }, input),
  }),
);
