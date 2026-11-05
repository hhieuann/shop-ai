import { randomUUID } from 'node:crypto';
import {
  ConditionalCheckFailedException,
  TransactionCanceledException,
  type AttributeValue,
} from '@aws-sdk/client-dynamodb';
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
  type DynamoDBDocumentClient,
} from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import {
  OutOfStockError,
  PriceChangedError,
  TooManyOpenOrdersError,
  type ChangedItem,
  type InvalidItem,
} from '../domain/errors.js';
import {
  isOpen,
  MAX_OPEN_ORDERS,
  PAYMENT_METHOD,
  toSummary,
  type Order,
  type OrderItem,
} from '../domain/order.js';
import {
  CartChangedError,
  type CancelOrderCommand,
  type OrderCancellation,
  type OrderConfirmation,
  type OrderHistory,
  type OrderHistoryPage,
  type OrderStore,
  type PlaceOrderCommand,
  type PlaceOrderResult,
} from '../ports.js';

/** SK của item bộ đếm đơn đang mở (ordering.md BR-14) */
export const OPEN_COUNTER_SK = '#OPEN';
/** Tiền tố SK của item đánh dấu chống tạo đơn trùng (dynamodb-design.md) */
export const MARKER_SK_PREFIX = '#KEY#';

const orderSchema = z.object({
  orderId: z.string(),
  userId: z.string(),
  status: z.enum(['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']),
  items: z.array(
    z.object({
      productId: z.string(),
      name: z.string(),
      price: z.number().int(),
      quantity: z.number().int(),
    }),
  ),
  totalAmount: z.number().int(),
  shippingFee: z.number().int(),
  shippingAddress: z.object({
    fullName: z.string(),
    phone: z.string(),
    address: z.string(),
    province: z.string(),
  }),
  paymentMethod: z.literal(PAYMENT_METHOD),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Các cột lịch sử đơn đọc (ProjectionExpression): không đọc shippingAddress (threat model O8) */
const historySchema = orderSchema.pick({
  orderId: true,
  status: true,
  items: true,
  totalAmount: true,
  createdAt: true,
});

export interface DynamoOrderStoreOptions {
  /** Hai giao dịch cùng đụng một item (vd. 2 request song song tới `#OPEN`) thì thử lại từng này lần */
  readonly maxConflictRetries?: number;
  /** Thời gian chờ trước lần thử lại đầu tiên (ms), gấp đôi mỗi lần; test đặt 0 */
  readonly baseDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Bảng orders (dynamodb-design.md): đơn, item bộ đếm `#OPEN`, item đánh dấu `#KEY#<idempotencyKey>`.
 * `place` ghi một TransactWriteItems n + 4 thao tác trên products, orders, carts (ADR-0017).
 */
export class DynamoOrderStore
  implements OrderStore, OrderHistory, OrderCancellation, OrderConfirmation
{
  private readonly maxConflictRetries: number;
  private readonly baseDelayMs: number;

  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tables: {
      readonly orders: string;
      readonly products: string;
      readonly carts: string;
    },
    options: DynamoOrderStoreOptions = {},
  ) {
    this.maxConflictRetries = options.maxConflictRetries ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 50;
  }

  async get(userId: string, orderId: string): Promise<Order | null> {
    const { Item } = await this.db.send(
      new GetCommand({ TableName: this.tables.orders, Key: { userId, orderId } }),
    );
    if (!Item || !Item.orderId || String(Item.orderId).startsWith('#')) return null;
    return orderSchema.parse(Item);
  }

  /**
   * Query mới nhất trước. Điều kiện khoá `orderId >= "0"` bỏ `#OPEN`, `#KEY#…` (`#` đứng trước
   * chữ số) trước khi DynamoDB đếm Limit, nên trang luôn đủ món; lọc sau bằng FilterExpression thì
   * trang có thể thiếu. Đọc limit + 1 để biết còn trang sau mà không trả về trang cuối rỗng.
   */
  async listByUser(
    userId: string,
    { limit, afterOrderId }: { readonly limit: number; readonly afterOrderId?: string },
  ): Promise<OrderHistoryPage> {
    const { Items = [] } = await this.db.send(
      new QueryCommand({
        TableName: this.tables.orders,
        KeyConditionExpression: 'userId = :u AND orderId >= :zero',
        ExpressionAttributeValues: { ':u': userId, ':zero': '0' },
        ExpressionAttributeNames: { '#status': 'status', '#items': 'items' },
        ProjectionExpression: 'orderId, #status, #items, totalAmount, createdAt',
        ScanIndexForward: false,
        Limit: limit + 1,
        // userId luôn của người trong token; cursor chỉ mang orderId
        ExclusiveStartKey: afterOrderId ? { userId, orderId: afterOrderId } : undefined,
      }),
    );
    const orders = Items.slice(0, limit).map((item) => toSummary(historySchema.parse(item)));
    return { orders, hasMore: Items.length > limit };
  }

  /** Worker xác nhận đơn: chỉ đổi khi đơn còn `PENDING` (khách có thể vừa huỷ) */
  async confirm({ order, now }: { readonly order: Order; readonly now: string }) {
    try {
      await this.db.send(
        new UpdateCommand({
          TableName: this.tables.orders,
          Key: { userId: order.userId, orderId: order.orderId },
          UpdateExpression: 'SET #status = :confirmed, updatedAt = :now',
          ConditionExpression: '#status = :pending',
          ExpressionAttributeNames: { '#status': 'status' },
          ExpressionAttributeValues: {
            ':confirmed': 'CONFIRMED',
            ':pending': 'PENDING',
            ':now': now,
          },
        }),
      );
      return 'confirmed' as const;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return 'notPending' as const;
      throw error;
    }
  }

  /**
   * Thứ tự: 0 đơn (điều kiện đúng trạng thái vừa đọc) · 1..n hoàn kho · (`#OPEN` khi đơn đang mở).
   * Điều kiện "đúng trạng thái vừa đọc" giữ cho quyết định giảm `#OPEN` còn đúng lúc ghi.
   */
  async cancel({ order, now }: CancelOrderCommand): Promise<'cancelled' | 'statusChanged'> {
    const updateOrder = {
      Update: {
        TableName: this.tables.orders,
        Key: { userId: order.userId, orderId: order.orderId },
        UpdateExpression: 'SET #status = :cancelled, updatedAt = :now',
        ConditionExpression: '#status = :seen',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':cancelled': 'CANCELLED',
          ':now': now,
          ':seen': order.status,
        },
      },
    };
    // attribute_exists: không để UpdateItem tạo item sản phẩm rác khi sản phẩm không còn trong bảng
    const restocks = order.items.map((item) => ({
      Update: {
        TableName: this.tables.products,
        Key: { productId: item.productId },
        UpdateExpression: 'SET stock = stock + :qty',
        ConditionExpression: 'attribute_exists(productId)',
        ExpressionAttributeValues: { ':qty': item.quantity },
      },
    }));
    const decrementOpen = isOpen(order.status)
      ? [
          {
            Update: {
              TableName: this.tables.orders,
              Key: { userId: order.userId, orderId: OPEN_COUNTER_SK },
              UpdateExpression: 'SET openOrders = openOrders - :one',
              ConditionExpression: 'openOrders > :zero',
              ExpressionAttributeValues: { ':one': 1, ':zero': 0 },
            },
          },
        ]
      : [];

    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) await sleep(this.baseDelayMs * 2 ** (attempt - 1));
      try {
        await this.db.send(
          new TransactWriteCommand({ TransactItems: [updateOrder, ...restocks, ...decrementOpen] }),
        );
        return 'cancelled';
      } catch (error) {
        if (!(error instanceof TransactionCanceledException)) throw error;
        const reasons = error.CancellationReasons ?? [];
        if (reasons[0]?.Code === 'ConditionalCheckFailed') return 'statusChanged';
        // Chỉ có TransactionConflict (request khác đụng cùng item) thì thử lại
        const conflict = reasons.some((r) => r.Code === 'TransactionConflict');
        const conditionFailed = reasons.some((r) => r.Code === 'ConditionalCheckFailed');
        if (conflict && !conditionFailed && attempt < this.maxConflictRetries) continue;
        // Sản phẩm không còn trong bảng hoặc `#OPEN` đã về 0: dữ liệu hỏng, để handler trả 500 (Q1, Q2)
        throw error;
      }
    }
  }

  async place(command: PlaceOrderCommand): Promise<PlaceOrderResult> {
    for (let attempt = 0; ; attempt++) {
      if (attempt > 0) await sleep(this.baseDelayMs * 2 ** (attempt - 1));
      try {
        await this.db.send(
          new TransactWriteCommand({ TransactItems: this.transactItems(command) }),
        );
        return { kind: 'created' };
      } catch (error) {
        if (!(error instanceof TransactionCanceledException)) throw error;
        const outcome = this.explain(command, error);
        if (outcome === 'conflict' && attempt < this.maxConflictRetries) continue;
        if (outcome === 'conflict') throw error;
        return outcome;
      }
    }
  }

  /** Thứ tự: 1..n trừ kho · n+1 ghi đơn · (giỏ) · `#OPEN` · item đánh dấu; vị trí dùng để đọc lý do huỷ */
  private transactItems({
    order,
    idempotencyKey,
    payloadHash,
    markerExpiresAt,
    cart,
  }: PlaceOrderCommand) {
    const decrements = order.items.map((item) => ({
      Update: {
        TableName: this.tables.products,
        Key: { productId: item.productId },
        UpdateExpression: 'SET stock = stock - :qty',
        ConditionExpression: 'stock >= :qty AND #status = :active AND price = :price',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':qty': item.quantity,
          ':active': 'ACTIVE',
          ':price': item.price,
        },
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD' as const,
      },
    }));
    const putOrder = {
      Put: {
        TableName: this.tables.orders,
        Item: { ...order },
        ConditionExpression: 'attribute_not_exists(orderId)',
      },
    };
    const updateCart = cart
      ? [
          {
            Update: {
              TableName: this.tables.carts,
              Key: { userId: order.userId },
              UpdateExpression: 'SET #items = :items, #version = :next, updatedAt = :now',
              ConditionExpression: '#version = :expected',
              ExpressionAttributeNames: { '#items': 'items', '#version': 'version' },
              ExpressionAttributeValues: {
                ':items': cart.remainingLines.map(
                  ({ productId, quantity, addedPrice, addedAt }) => ({
                    productId,
                    quantity,
                    addedPrice,
                    addedAt,
                  }),
                ),
                ':next': randomUUID(),
                ':now': order.createdAt,
                ':expected': cart.expectedVersion,
              },
            },
          },
        ]
      : [];
    const incrementOpen = {
      Update: {
        TableName: this.tables.orders,
        Key: { userId: order.userId, orderId: OPEN_COUNTER_SK },
        UpdateExpression: 'SET openOrders = if_not_exists(openOrders, :zero) + :one',
        ConditionExpression: 'attribute_not_exists(openOrders) OR openOrders < :max',
        ExpressionAttributeValues: { ':zero': 0, ':one': 1, ':max': MAX_OPEN_ORDERS },
      },
    };
    const putMarker = {
      Put: {
        TableName: this.tables.orders,
        Item: {
          userId: order.userId,
          orderId: `${MARKER_SK_PREFIX}${idempotencyKey}`,
          refOrderId: order.orderId,
          payloadHash,
          expiresAt: markerExpiresAt,
        },
        ConditionExpression: 'attribute_not_exists(orderId)',
        ReturnValuesOnConditionCheckFailure: 'ALL_OLD' as const,
      },
    };
    return [...decrements, putOrder, ...updateCart, incrementOpen, putMarker];
  }

  /**
   * Đọc CancellationReasons theo đúng thứ tự xét ở dynamodb-design.md:
   * item đánh dấu → giỏ đổi version → tồn kho, giá → đơn mở. Chỉ có TransactionConflict thì thử lại.
   */
  private explain(
    { order, cart }: PlaceOrderCommand,
    error: TransactionCanceledException,
  ): PlaceOrderResult | 'conflict' {
    const reasons = error.CancellationReasons ?? [];
    const failed = (index: number) => reasons[index]?.Code === 'ConditionalCheckFailed';
    const n = order.items.length;
    const cartIndex = cart ? n + 1 : -1;
    const openIndex = cart ? n + 2 : n + 1;
    const markerIndex = openIndex + 1;

    if (failed(markerIndex)) {
      const old = reasons[markerIndex]?.Item;
      return {
        kind: 'existing',
        orderId: stringAttr(old, 'refOrderId'),
        payloadHash: stringAttr(old, 'payloadHash'),
      };
    }
    if (cartIndex >= 0 && failed(cartIndex)) throw new CartChangedError(order.userId);

    const invalidItems: InvalidItem[] = [];
    const changedItems: ChangedItem[] = [];
    order.items.forEach((item, index) => {
      if (!failed(index)) return;
      classifyProduct(item, reasons[index]?.Item, invalidItems, changedItems);
    });
    if (invalidItems.length > 0) throw new OutOfStockError(invalidItems);
    if (changedItems.length > 0) throw new PriceChangedError(changedItems);
    if (failed(openIndex)) throw new TooManyOpenOrdersError(MAX_OPEN_ORDERS);

    if (reasons.some((reason) => reason.Code === 'TransactionConflict')) return 'conflict';
    // Trùng orderId (ULID) hoặc lý do khác không lường trước: để handler trả 500
    throw error;
  }
}

/** Sản phẩm sai điều kiện lúc ghi: có người mua hoặc đổi giá giữa bước đọc và giao dịch */
function classifyProduct(
  item: OrderItem,
  old: Record<string, AttributeValue> | undefined,
  invalidItems: InvalidItem[],
  changedItems: ChangedItem[],
): void {
  const stock = Number(old?.stock?.N ?? 0);
  const status = old?.status?.S;
  const price = Number(old?.price?.N ?? item.price);
  if (!old || status !== 'ACTIVE') {
    invalidItems.push({ productId: item.productId, available: 0 });
  } else if (stock < item.quantity) {
    invalidItems.push({ productId: item.productId, available: Math.max(0, stock) });
  } else if (price !== item.price) {
    changedItems.push({
      productId: item.productId,
      expectedPrice: item.price,
      currentPrice: price,
    });
  }
}

function stringAttr(item: Record<string, AttributeValue> | undefined, name: string): string {
  const value = item?.[name]?.S;
  if (value === undefined) throw new Error(`Item đánh dấu thiếu thuộc tính ${name}`);
  return value;
}
