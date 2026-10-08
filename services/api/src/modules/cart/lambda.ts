import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { makeIdempotentUseCase } from '../../shared/idempotency.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import {
  addCartItem,
  getCart,
  mergeCart,
  removeCartItem,
  updateCartItem,
  type CartDeps,
} from './application/cartService.js';
import type { GuestItem } from './domain/cart.js';
import { makeHandler } from './handler.js';
import { DynamoCartRepository } from './infra/dynamoCartRepository.js';
import { DynamoProductCatalog } from './infra/dynamoProductCatalog.js';

// Chỗ duy nhất ghép use case với adapter thật; CDK trỏ Lambda vào file này.
// Client tạo một lần ngoài handler để dùng lại giữa các request, giảm thời gian khởi động.
// captureClient: mỗi lần gọi DynamoDB thành một subsegment trên X-Ray (#91).
const client = captureClient(new DynamoDBClient({}));
const db = DynamoDBDocumentClient.from(client);
const deps: CartDeps = {
  carts: new DynamoCartRepository(db, requiredEnv('CARTS_TABLE')),
  // Bảng của catalog, chỉ đọc (ADR-0017)
  catalog: new DynamoProductCatalog(db, requiredEnv('PRODUCTS_TABLE')),
  now: () => new Date().toISOString(),
};

// Gộp giỏ chống chạy hai lần theo userId + Idempotency-Key, lưu 24 giờ ở bảng riêng của cart (ADR-0017)
const idempotentMerge = makeIdempotentUseCase(
  (payload: { readonly items: readonly GuestItem[] }, userId: string) =>
    mergeCart(deps, { userId, items: payload.items }),
  {
    tableName: requiredEnv('CART_IDEMPOTENCY_TABLE'),
    inProgressCode: 'MERGE_IN_PROGRESS',
    client,
  },
);

export const handler = withTracing(
  makeHandler({
    getCart: (input) => getCart(deps, input),
    addCartItem: (input) => addCartItem(deps, input),
    updateCartItem: (input) => updateCartItem(deps, input),
    removeCartItem: (input) => removeCartItem(deps, input),
    mergeCart: ({ userId, idempotencyKey, items }, context) =>
      idempotentMerge({ userId, idempotencyKey, payload: { items } }, context),
  }),
);
