import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { makeAdminHandler } from './adminHandler.js';
import { advanceOrderStatus } from './application/advanceOrderStatus.js';
import { listAdminOrders } from './application/listAdminOrders.js';
import { DynamoOrderStore } from './infra/dynamoOrderStore.js';

// Lambda riêng của API admin đơn hàng (ordering.md BR-15), tách khỏi Lambda ordering để chỉ có quyền
// trên bảng orders: đọc index byStatus, đọc lại đơn, đổi trạng thái và `#OPEN`. Không trừ kho, không
// sửa giỏ, không gửi tin cho worker. CDK trỏ Lambda OrderAdminFunction vào file này (addOrderAdmin).
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const orders = new DynamoOrderStore(db, {
  orders: requiredEnv('ORDERS_TABLE'),
  // Admin không gọi place, cancel nên không dùng tới hai bảng này
  products: '',
  carts: '',
});

export const handler = withTracing(
  makeAdminHandler({
    // Chỉ đọc nên không bọc idempotency
    listAdminOrders: (input) => listAdminOrders({ admin: orders }, input),
    // Ghi có điều kiện trạng thái nguồn: gửi lại lần hai thì 409, không đổi hai lần
    advanceOrderStatus: (input) =>
      advanceOrderStatus({ admin: orders, orders, now: () => new Date().toISOString() }, input),
  }),
);
