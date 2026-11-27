import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { makeAdminProductHandler } from './adminHandler.js';
import { getAdminProduct } from './application/getAdminProduct.js';
import { listAdminProducts } from './application/listAdminProducts.js';
import { DynamoAdminProductReader } from './infra/dynamoAdminProductReader.js';
import { DynamoProductRepository } from './infra/dynamoProductRepository.js';

// Lambda riêng của API admin sản phẩm (catalog.md BR-09 … BR-15), tách khỏi Lambda catalog công khai
// (chỉ đọc món ACTIVE). Hạ tầng (#546) trỏ Lambda CatalogAdminFunction vào file này. Không cache
// danh sách trong bộ nhớ như API khách: admin cần thấy ngay món vừa sửa.
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const table = requiredEnv('PRODUCTS_TABLE');
const products = new DynamoProductRepository(db, table);
const reader = new DynamoAdminProductReader(db, table);

export const handler = withTracing(
  makeAdminProductHandler({
    listAdminProducts: (input) => listAdminProducts({ reader }, input),
    getAdminProduct: (input) => getAdminProduct({ products }, input),
  }),
);
