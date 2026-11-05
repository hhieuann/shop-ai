/**
 * Luật đặt hàng và huỷ đơn (docs/business/ordering.md). Hàm thuần, không I/O:
 * nhận món khách gửi và thông tin sản phẩm mới nhất, trả đơn hoặc ném lỗi nghiệp vụ.
 */
import {
  OutOfStockError,
  PriceChangedError,
  type ChangedItem,
  type InvalidItem,
} from './errors.js';

/** BR-02: tối đa 50 dòng mỗi đơn */
export const MAX_LINES = 50;
/** Cùng giới hạn số lượng mỗi món với giỏ (cart.md BR-03) */
export const MAX_QUANTITY = 99;
/** BR-14: tối đa 3 đơn đang mở mỗi tài khoản */
export const MAX_OPEN_ORDERS = 3;
/** BR-06: miễn phí vận chuyển trong MVP */
export const SHIPPING_FEE = 0;
/** BR-05 */
export const PAYMENT_METHOD = 'COD';

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

/** Món khách gửi lên: chỉ các món đã tick trong giỏ, kèm giá đang hiển thị (BR-07) */
export interface RequestedItem {
  readonly productId: string;
  readonly quantity: number;
  readonly expectedPrice: number;
}

/** Thông tin sản phẩm ordering cần, đọc mới mỗi lần đặt qua port ProductCatalog */
export interface ProductSnapshot {
  readonly productId: string;
  readonly name: string;
  readonly price: number;
  readonly stock: number;
  readonly status: 'ACTIVE' | 'INACTIVE';
}

/** Khớp schema ShippingAddress trong contracts/openapi.yaml */
export interface ShippingAddress {
  readonly fullName: string;
  readonly phone: string;
  readonly address: string;
  readonly province: string;
}

/** Snapshot món lúc đặt, khớp schema OrderItem */
export interface OrderItem {
  readonly productId: string;
  readonly name: string;
  readonly price: number;
  readonly quantity: number;
}

/** Khớp schema Order trong contracts/openapi.yaml */
export interface Order {
  readonly orderId: string;
  readonly userId: string;
  readonly status: OrderStatus;
  readonly items: readonly OrderItem[];
  readonly totalAmount: number;
  readonly shippingFee: number;
  readonly shippingAddress: ShippingAddress;
  readonly paymentMethod: typeof PAYMENT_METHOD;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Khớp schema OrderSummary: dòng trong lịch sử đơn */
export interface OrderSummary {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly totalAmount: number;
  /** Số loại sản phẩm trong đơn */
  readonly itemCount: number;
  readonly createdAt: string;
}

/**
 * BR-03, BR-07: kiểm lại từng món, không tin dữ liệu từ client.
 * Món hết hàng, thiếu số lượng, ngừng bán hoặc không còn trong catalog → OUT_OF_STOCK,
 * xét trước PRICE_CHANGED: món không đặt được thì giá mới không còn ý nghĩa với khách.
 * Báo đủ mọi món lỗi trong một lần để khách sửa một lượt.
 */
export function checkItems(
  requested: readonly RequestedItem[],
  products: ReadonlyMap<string, ProductSnapshot>,
): void {
  const invalidItems: InvalidItem[] = [];
  const changedItems: ChangedItem[] = [];
  for (const item of requested) {
    const product = products.get(item.productId);
    if (!product || product.status !== 'ACTIVE') {
      invalidItems.push({ productId: item.productId, available: 0 });
    } else if (product.stock < item.quantity) {
      invalidItems.push({ productId: item.productId, available: Math.max(0, product.stock) });
    } else if (product.price !== item.expectedPrice) {
      changedItems.push({
        productId: item.productId,
        expectedPrice: item.expectedPrice,
        currentPrice: product.price,
      });
    }
  }
  if (invalidItems.length > 0) throw new OutOfStockError(invalidItems);
  if (changedItems.length > 0) throw new PriceChangedError(changedItems);
}

export interface NewOrderInput {
  readonly orderId: string;
  readonly userId: string;
  readonly requested: readonly RequestedItem[];
  readonly products: ReadonlyMap<string, ProductSnapshot>;
  readonly shippingAddress: ShippingAddress;
  readonly now: string;
}

/**
 * Đơn mới PENDING sau khi checkItems đã đạt. Snapshot tên và giá lúc đặt;
 * BR-06: totalAmount = Σ giá × số lượng, phí vận chuyển 0.
 */
export function buildOrder(input: NewOrderInput): Order {
  checkItems(input.requested, input.products);
  const items = input.requested.map((item): OrderItem => {
    // checkItems đã bảo đảm sản phẩm có trong Map
    const product = input.products.get(item.productId) as ProductSnapshot;
    return {
      productId: item.productId,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
    };
  });
  return {
    orderId: input.orderId,
    userId: input.userId,
    status: 'PENDING',
    items,
    totalAmount: items.reduce((sum, item) => sum + item.price * item.quantity, 0) + SHIPPING_FEE,
    shippingFee: SHIPPING_FEE,
    shippingAddress: input.shippingAddress,
    paymentMethod: PAYMENT_METHOD,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/** Chỉ cần các cột lịch sử đơn đọc, nên dùng được cả với item không có shippingAddress */
export function toSummary(
  order: Pick<Order, 'orderId' | 'status' | 'items' | 'totalAmount' | 'createdAt'>,
): OrderSummary {
  return {
    orderId: order.orderId,
    status: order.status,
    totalAmount: order.totalAmount,
    itemCount: order.items.length,
    createdAt: order.createdAt,
  };
}

/** BR-14: đơn đang mở là đơn đã trừ kho mà hàng chưa rời kho */
export function isOpen(status: OrderStatus): boolean {
  return status === 'PENDING' || status === 'CONFIRMED';
}

/** BR-10, BR-11: trạng thái huỷ được theo vai trò */
export function cancellableStatuses(role: 'customer' | 'admin'): readonly OrderStatus[] {
  return role === 'admin' ? ['PENDING', 'CONFIRMED', 'SHIPPED'] : ['PENDING', 'CONFIRMED'];
}

export function canCancel(status: OrderStatus, role: 'customer' | 'admin'): boolean {
  return cancellableStatuses(role).includes(status);
}
