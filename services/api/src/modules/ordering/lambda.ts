import { AsyncLocalStorage } from 'node:async_hooks';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { requiredEnv } from '../../shared/config.js';
import { makeIdempotentUseCase } from '../../shared/idempotency.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { placeOrder, type PlaceOrderDeps } from './application/placeOrder.js';
import type { RequestedItem, ShippingAddress } from './domain/order.js';
import { makeHandler } from './handler.js';
import { DynamoCartReader } from './infra/dynamoCartReader.js';
import { DynamoOrderStore } from './infra/dynamoOrderStore.js';
import { DynamoProductCatalog } from './infra/dynamoProductCatalog.js';
import { PowertoolsOrderMetrics } from './infra/powertoolsOrderMetrics.js';
import { SqsOrderQueue } from './infra/sqsOrderQueue.js';

// Chỗ duy nhất ghép use case với adapter thật; CDK trỏ Lambda vào file này (addOrdering).
// Client tạo một lần ngoài handler để dùng lại giữa các request.
const dynamo = captureClient(new DynamoDBClient({}));
const db = DynamoDBDocumentClient.from(dynamo);
const deps: PlaceOrderDeps = {
  catalog: new DynamoProductCatalog(db, requiredEnv('PRODUCTS_TABLE')),
  carts: new DynamoCartReader(db, requiredEnv('CARTS_TABLE')),
  orders: new DynamoOrderStore(db, {
    orders: requiredEnv('ORDERS_TABLE'),
    products: requiredEnv('PRODUCTS_TABLE'),
    carts: requiredEnv('CARTS_TABLE'),
  }),
  queue: new SqsOrderQueue(captureClient(new SQSClient({})), requiredEnv('ORDERS_QUEUE_URL')),
  // Namespace từ POWERTOOLS_METRICS_NAMESPACE, dimension service từ POWERTOOLS_SERVICE_NAME
  metrics: new PowertoolsOrderMetrics(new Metrics()),
  // ULID theo chuẩn code: duy nhất và tăng dần theo thời gian, lịch sử đơn sắp đúng mới nhất trước
  newOrderId: () => ulid(),
  now: () => new Date().toISOString(),
};

interface PlaceOrderPayload {
  readonly idempotencyKey: string;
  readonly items: readonly RequestedItem[];
  readonly shippingAddress: ShippingAddress;
}

// correlationId khác nhau giữa các lần gọi lại cùng khoá, nên không nằm trong payload (Powertools
// băm payload để so nội dung); truyền theo từng request qua AsyncLocalStorage.
const correlation = new AsyncLocalStorage<string>();

// Chống tạo đơn hai lần theo userId + Idempotency-Key, lưu 24 giờ ở bảng riêng của ordering (ADR-0017).
// Lỗi sau commit làm Powertools quên kết quả thì item đánh dấu trong bảng orders bắt lại (#237).
const idempotentPlaceOrder = makeIdempotentUseCase(
  (payload: PlaceOrderPayload, userId: string) =>
    placeOrder(deps, { ...payload, userId, correlationId: correlation.getStore() ?? '' }),
  {
    tableName: requiredEnv('ORDER_IDEMPOTENCY_TABLE'),
    inProgressCode: 'ORDER_IN_PROGRESS',
    client: dynamo,
  },
);

export const handler = withTracing(
  makeHandler({
    placeOrder: ({ userId, idempotencyKey, correlationId, items, shippingAddress }, context) =>
      correlation.run(correlationId, () =>
        idempotentPlaceOrder(
          { userId, idempotencyKey, payload: { idempotencyKey, items, shippingAddress } },
          context,
        ),
      ),
  }),
);
