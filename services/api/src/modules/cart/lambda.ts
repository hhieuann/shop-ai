import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import {
  addCartItem,
  getCart,
  removeCartItem,
  updateCartItem,
  type CartDeps,
} from './application/cartService.js';
import { makeHandler } from './handler.js';
import { DynamoCartRepository } from './infra/dynamoCartRepository.js';
import { DynamoProductCatalog } from './infra/dynamoProductCatalog.js';

// Chỗ duy nhất ghép use case với adapter thật; CDK trỏ Lambda vào file này.
// Client tạo một lần ngoài handler để dùng lại giữa các request, giảm thời gian khởi động.
const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const deps: CartDeps = {
  carts: new DynamoCartRepository(db, requiredEnv('CARTS_TABLE')),
  // Bảng của catalog, chỉ đọc (ADR-0017)
  catalog: new DynamoProductCatalog(db, requiredEnv('PRODUCTS_TABLE')),
  now: () => new Date().toISOString(),
};

export const handler = makeHandler({
  getCart: (input) => getCart(deps, input),
  addCartItem: (input) => addCartItem(deps, input),
  updateCartItem: (input) => updateCartItem(deps, input),
  removeCartItem: (input) => removeCartItem(deps, input),
});
