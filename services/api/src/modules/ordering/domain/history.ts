import { InvalidOrderCursorError } from './errors.js';

/** Lịch sử đơn: mặc định 20 đơn mỗi trang, tối đa 50 (quy ước API, contracts/openapi.yaml listOrders) */
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

/** Cursor là chuỗi ngắn; dài hơn mức này thì chắc chắn không phải cursor do API tạo */
const MAX_CURSOR_LENGTH = 200;

/** ULID: 26 ký tự Crockford base32. Item `#OPEN`, `#KEY#…` cùng partition không khớp mẫu này. */
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function isOrderId(value: string): boolean {
  return ULID.test(value);
}

interface CursorPayload {
  readonly o: string;
}

/**
 * Cursor là orderId của đơn cuối trang, mã hoá base64url để web coi như chuỗi mờ.
 * Không chứa userId: trang sau luôn đọc partition của người trong token, nên sửa cursor
 * cũng không xem được đơn người khác.
 */
export function encodeOrderCursor(lastOrderId: string): string {
  const payload: CursorPayload = { o: lastOrderId };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/** Cursor sai định dạng hoặc không chứa ULID → InvalidOrderCursorError (API trả 400). */
export function decodeOrderCursor(cursor: string): string {
  if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) {
    throw new InvalidOrderCursorError();
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    throw new InvalidOrderCursorError();
  }

  if (typeof payload !== 'object' || payload === null) throw new InvalidOrderCursorError();
  const orderId = (payload as Record<string, unknown>).o;
  if (typeof orderId !== 'string' || !isOrderId(orderId)) throw new InvalidOrderCursorError();
  return orderId;
}
