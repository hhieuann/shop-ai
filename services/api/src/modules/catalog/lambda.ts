import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { createActiveProducts } from './application/activeProducts.js';
import { getProduct } from './application/getProduct.js';
import { listProducts } from './application/listProducts.js';
import { makeHandler } from './handler.js';
import { DynamoProductRepository } from './infra/dynamoProductRepository.js';

// Chỗ duy nhất ghép use case với adapter thật; CDK trỏ Lambda vào file này.
// Client tạo một lần ngoài handler để dùng lại giữa các request, giảm thời gian khởi động.
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const products = new DynamoProductRepository(db, requiredEnv('PRODUCTS_TABLE'));
// Cache 60 giây cũng tạo ngoài handler, để các request trên cùng một Lambda dùng chung
const activeProducts = createActiveProducts({ reader: products });

export const handler = withTracing(
  makeHandler({
    getProduct: (input) => getProduct({ products }, input),
    listProducts: (input) => listProducts({ activeProducts }, input),
  }),
);
