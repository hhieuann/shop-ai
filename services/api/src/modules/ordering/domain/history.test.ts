import { describe, expect, it } from 'vitest';
import { InvalidOrderCursorError } from './errors.js';
import { decodeOrderCursor, encodeOrderCursor, isOrderId } from './history.js';

const ORDER_ID = '01K8GQ5Z3XM2T9V4B6N8P0R2S4';

describe('isOrderId', () => {
  it.each([
    ['ULID', ORDER_ID, true],
    ['item bộ đếm', '#OPEN', false],
    ['item đánh dấu', '#KEY#abc', false],
    ['chuỗi rỗng', '', false],
    ['chữ thường', ORDER_ID.toLowerCase(), false],
    ['có chữ I, L, O, U', '01K8GQ5Z3XM2T9V4B6N8P0R2SU', false],
    ['thiếu một ký tự', ORDER_ID.slice(1), false],
  ])('isOrderId_%s', (_label, value, expected) => {
    // Act
    const result = isOrderId(value);

    // Assert
    expect(result).toBe(expected);
  });
});

describe('order cursor', () => {
  it('decodeOrderCursor_returnsOrderId_whenEncodedByApi', () => {
    // Arrange
    const cursor = encodeOrderCursor(ORDER_ID);

    // Act
    const orderId = decodeOrderCursor(cursor);

    // Assert: cursor là chuỗi mờ an toàn trên URL, không chứa userId
    expect(orderId).toBe(ORDER_ID);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it.each([
    ['rỗng', ''],
    ['dài quá 200 ký tự', 'a'.repeat(201)],
    ['không phải JSON', Buffer.from('xyz').toString('base64url')],
    ['JSON không phải object', Buffer.from('"abc"').toString('base64url')],
    ['thiếu o', Buffer.from('{}').toString('base64url')],
    ['o là item bộ đếm', Buffer.from('{"o":"#OPEN"}').toString('base64url')],
    ['o không phải chuỗi', Buffer.from('{"o":1}').toString('base64url')],
  ])('decodeOrderCursor_throwsInvalidCursor_when%s', (_label, cursor) => {
    // Act
    const act = () => decodeOrderCursor(cursor);

    // Assert
    expect(act).toThrow(InvalidOrderCursorError);
  });
});
