import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SNSClient } from '@aws-sdk/client-sns';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import {
  processOrderMessage,
  type ProcessOrderMessageDeps,
} from './application/processOrderMessage.js';
import { DynamoOrderStore } from './infra/dynamoOrderStore.js';
import { SnsOrderEvents } from './infra/snsOrderEvents.js';
import { makeProcessorHandler } from './processorHandler.js';

// Lambda riêng của worker order-processor (SQS), tách khỏi Lambda API để mỗi cái chỉ có quyền nó cần.
// Worker chỉ đọc, xác nhận đơn; không đặt, không huỷ, nên không cần bảng products, carts.
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));

const deps: ProcessOrderMessageDeps = {
  orders: new DynamoOrderStore(db, {
    orders: requiredEnv('ORDERS_TABLE'),
    // Worker không gọi place, cancel nên không dùng tới hai bảng này
    products: '',
    carts: '',
  }),
  events: new SnsOrderEvents(
    captureClient(new SNSClient({})),
    requiredEnv('ORDER_CONFIRMED_TOPIC_ARN'),
  ),
  now: () => new Date().toISOString(),
};

export const handler = withTracing(
  makeProcessorHandler({ processOrderMessage: (message) => processOrderMessage(deps, message) }),
);
