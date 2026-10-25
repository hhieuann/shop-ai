import { AsyncLocalStorage } from 'node:async_hooks';
import { Metrics } from '@aws-lambda-powertools/metrics';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { SNSClient } from '@aws-sdk/client-sns';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Context, SQSEvent } from 'aws-lambda';
import { requiredEnv } from '../../shared/config.js';
import { makeIdempotentUseCase } from '../../shared/idempotency.js';
import { logger } from '../../shared/logger.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import {
  processOrderMessage,
  type ProcessOrderMessageDeps,
} from './application/processOrderMessage.js';
import { sendOrderEmail, type SendOrderEmailDeps } from './application/sendOrderEmail.js';
import type { EmailKind } from './domain/notification.js';
import type { Order } from './domain/order.js';
import { emailConfig, type EmailConfig } from './emailConfig.js';
import { CognitoCustomerDirectory } from './infra/cognitoCustomerDirectory.js';
import { DynamoOrderStore } from './infra/dynamoOrderStore.js';
import { PowertoolsOrderMetrics } from './infra/powertoolsOrderMetrics.js';
import { sesClientConfig, SesMailer } from './infra/sesMailer.js';
import { SnsOrderEvents } from './infra/snsOrderEvents.js';
import { makeProcessorHandler } from './processorHandler.js';

// Lambda riêng của worker order-processor (SQS), tách khỏi Lambda API để mỗi cái chỉ có quyền nó cần.
// Worker chỉ đọc, xác nhận đơn và gửi thư; không đặt, không huỷ, nên không cần bảng products, carts.
const dynamo = captureClient(new DynamoDBClient({}));
const db = DynamoDBDocumentClient.from(dynamo);

// Context của lần gọi hiện tại: Powertools Idempotency cần nó để bản ghi IN_PROGRESS hết hạn cùng Lambda
const lambdaContext = new AsyncLocalStorage<Context | undefined>();

/**
 * Gửi thư cho chủ đơn, chống gửi trùng theo `<orderId>#<loại thư>` ở bảng order-idempotency (ADR-0017).
 * Payload chỉ có mã đơn và loại thư (Powertools băm payload để so); đơn truyền theo từng lần gọi qua
 * AsyncLocalStorage. Bị SES từ chối cũng là kết quả và được lưu, nên lần giao lại không gửi thử nữa.
 */
function makeSendEmail(config: EmailConfig): NonNullable<ProcessOrderMessageDeps['sendEmail']> {
  const emailDeps: SendOrderEmailDeps = {
    customers: new CognitoCustomerDirectory(
      captureClient(new CognitoIdentityProviderClient({})),
      config.userPoolId,
    ),
    mailer: new SesMailer(captureClient(new SESv2Client(sesClientConfig)), config.senderEmail),
    // Namespace từ POWERTOOLS_METRICS_NAMESPACE, dimension service từ POWERTOOLS_SERVICE_NAME
    metrics: new PowertoolsOrderMetrics(new Metrics()),
  };
  const currentOrder = new AsyncLocalStorage<Order>();
  const idempotentSend = makeIdempotentUseCase(
    (payload: { readonly orderId: string; readonly kind: EmailKind }) => {
      const order = currentOrder.getStore();
      if (!order) throw new Error(`Thiếu đơn ${payload.orderId} khi gửi thư`);
      return sendOrderEmail(emailDeps, order, payload.kind);
    },
    {
      tableName: config.idempotencyTable,
      inProgressCode: 'ORDER_EMAIL_IN_PROGRESS',
      client: dynamo,
    },
  );
  return (order, kind) =>
    currentOrder.run(order, async () => {
      const { value } = await idempotentSend(
        {
          userId: order.userId,
          idempotencyKey: `${order.orderId}#${kind}`,
          payload: { orderId: order.orderId, kind },
        },
        lambdaContext.getStore(),
      );
      return value;
    });
}

// Biến của bước thư đọc tuỳ chọn (emailConfig.ts): thiếu thì worker vẫn xác nhận đơn, gửi tin.
// Log một lần lúc khởi động, chỉ tên biến, không giá trị.
const email = emailConfig(process.env);
if (!email.enabled) {
  logger.info('Chưa đủ cấu hình gửi thư, worker bỏ bước gửi thư', { missing: email.missing });
}

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
  ...(email.enabled ? { sendEmail: makeSendEmail(email.config) } : {}),
};

const processor = makeProcessorHandler({
  processOrderMessage: (message) => processOrderMessage(deps, message),
});

export const handler = withTracing((event: SQSEvent, context?: Context) =>
  lambdaContext.run(context, () => processor(event)),
);
