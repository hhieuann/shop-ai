import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { BadRequestError } from './errors.js';
import { parseIdempotencyKey } from './idempotency.js';

describe('parseIdempotencyKey', () => {
  it('parseIdempotencyKey_returnsLowercaseKey_whenHeaderIsUuid', () => {
    // Arrange: HTTP API đưa tên header về chữ thường, giá trị giữ nguyên
    const uuid = randomUUID();
    const headers = { 'idempotency-key': uuid.toUpperCase() };

    // Act
    const key = parseIdempotencyKey(headers);

    // Assert
    expect(key).toBe(uuid);
  });

  it.each([
    { name: 'parseIdempotencyKey_throwsBadRequest_whenHeaderMissing', headers: {} },
    {
      name: 'parseIdempotencyKey_throwsBadRequest_whenHeaderEmpty',
      headers: { 'idempotency-key': '' },
    },
    {
      name: 'parseIdempotencyKey_throwsBadRequest_whenHeaderNotUuid',
      headers: { 'idempotency-key': 'lan-gop-1' },
    },
  ])('$name', ({ headers }) => {
    // Act + Assert
    expect(() => parseIdempotencyKey(headers)).toThrow(BadRequestError);
  });
});
