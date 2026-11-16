import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SQSClient } from '@aws-sdk/client-sqs';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { logger } from '../../shared/logger.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { adminCancelConfig } from './adminCancelConfig.js';
import { makeAdminHandler } from './adminHandler.js';
import { adminCancelOrder, type AdminCancelOrderInput } from './application/adminCancelOrder.js';
import { advanceOrderStatus } from './application/advanceOrderStatus.js';
import { listAdminOrders } from './application/listAdminOrders.js';
import { DynamoOrderStore } from './infra/dynamoOrderStore.js';
import { orderingMetrics, PowertoolsOrderMetrics } from './infra/powertoolsOrderMetrics.js';
import { SqsOrderQueue } from './infra/sqsOrderQueue.js';

// Lambda riêng của API admin đơn hàng (ordering.md BR-15, BR-11), tách khỏi Lambda ordering: đọc index
// byStatus, đọc lại đơn, đổi trạng thái và `#OPEN`; khi huỷ đơn thì cộng kho bảng products (ADR-0017)
// và gửi tin CANCELLED lên hàng đợi đơn. Không đọc, không sửa giỏ. CDK trỏ Lambda OrderAdminFunction
// vào file này (addOrderAdmin).
const cancel = adminCancelConfig(process.env);
if (!cancel.enabled) {
  // Hạ tầng (#449) chưa thêm biến: tắt huỷ đơn, xem và chuyển trạng thái vẫn chạy
  logger.warn('Chưa đủ cấu hình huỷ đơn, DELETE admin tắt', { missing: cancel.missing });
}

const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const orders = new DynamoOrderStore(db, {
  orders: requiredEnv('ORDERS_TABLE'),
  // products chỉ dùng khi huỷ đơn (cộng kho); admin không gọi place nên không dùng carts
  products: cancel.enabled ? cancel.config.productsTable : '',
  carts: '',
});
const now = () => new Date().toISOString();

export const handler = withTracing(
  makeAdminHandler({
    // Chỉ đọc nên không bọc idempotency
    listAdminOrders: (input) => listAdminOrders({ admin: orders }, input),
    // Ghi có điều kiện trạng thái nguồn: gửi lại lần hai thì 409, không đổi hai lần
    advanceOrderStatus: (input) => advanceOrderStatus({ admin: orders, orders, now }, input),
    // Ghi có điều kiện trạng thái vừa đọc: huỷ lần hai thì 409, không hoàn kho hai lần
    adminCancelOrder: cancel.enabled
      ? (() => {
          const queue = new SqsOrderQueue(
            captureClient(new SQSClient({})),
            cancel.config.ordersQueueUrl,
          );
          // service=ordering để alarm order-enqueue-failed thấy cả lỗi gửi tin huỷ của admin
          const metrics = new PowertoolsOrderMetrics(orderingMetrics());
          return (input: AdminCancelOrderInput) =>
            adminCancelOrder({ admin: orders, orders, queue, metrics, now }, input);
        })()
      : async () => {
          // Lỗi không phải AppError: handler log và trả 500, không lộ chi tiết
          throw new Error(`Huỷ đơn admin chưa bật: thiếu ${cancel.missing.join(', ')}`);
        },
  }),
);
