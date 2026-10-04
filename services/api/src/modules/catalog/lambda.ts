import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { getProduct } from './application/getProduct.js';
import { makeHandler } from './handler.js';
import { DynamoProductRepository } from './infra/dynamoProductRepository.js';

// Chỗ duy nhất ghép use case với adapter thật; CDK trỏ Lambda vào file này.
// Client tạo một lần ngoài handler để dùng lại giữa các request, giảm thời gian khởi động.
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const products = new DynamoProductRepository(db, requiredEnv('PRODUCTS_TABLE'));

export const handler = makeHandler({
  getProduct: (input) => getProduct({ products }, input),
});
