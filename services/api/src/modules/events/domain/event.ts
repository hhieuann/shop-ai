/**
 * Sự kiện hành vi cho gợi ý (docs/business/events.md).
 * Client chỉ gửi được VIEW và ADD_TO_CART; PURCHASE chỉ đến từ topic order-confirmed (events.md mục 1).
 */
export const CLIENT_EVENT_TYPES = ['VIEW', 'ADD_TO_CART'] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];
export type EventType = ClientEventType | 'PURCHASE';

/** Bảng events chỉ giữ 90 ngày, khớp luật xoá dữ liệu cũ của bucket huấn luyện (góp ý ở #179) */
export const RETENTION_DAYS = 90;

/** Một dòng trong bảng events. Không có userId thật, chỉ có bản băm HMAC (events.md mục 2). */
export interface StoredEvent {
  readonly userIdHash: string;
  readonly eventId: string;
  readonly productId: string;
  readonly eventType: EventType;
  /** ISO 8601 UTC, do server đặt (events.md mục 3) */
  readonly timestamp: string;
  /** Giây kể từ 1970, để DynamoDB TTL tự xoá sau RETENTION_DAYS ngày */
  readonly ttl: number;
  /** Chỉ có ở PURCHASE: pipeline gom món theo đơn cho luật mua kèm (events.md mục 1) */
  readonly orderId?: string;
  /** Chỉ có ở PURCHASE: số lượng của món trong đơn */
  readonly quantity?: number;
}

export function expiresAt(timestamp: string): number {
  return Math.floor(Date.parse(timestamp) / 1000) + RETENTION_DAYS * 24 * 60 * 60;
}

/**
 * ID của sự kiện PURCHASE không ngẫu nhiên mà suy ra từ đơn và sản phẩm.
 * SQS có thể giao một tin nhiều lần (at-least-once); cùng tin thì cùng khoá, nên ghi lần hai
 * bị điều kiện `attribute_not_exists` chặn, không sinh lượt mua giả làm lệch gợi ý.
 */
export function purchaseEventId(orderId: string, productId: string): string {
  return `${orderId}#${productId}`;
}
