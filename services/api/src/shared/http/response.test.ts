import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseBody } from '../../../test/helpers/http.js';
import { BadRequestError, ConflictError, NotFoundError } from '../errors.js';
import { errorToProblem, validationProblem } from './response.js';

describe('errorToProblem', () => {
  it.each([
    {
      name: 'errorToProblem_returns400_whenBadRequestError',
      error: new BadRequestError('Con trỏ phân trang không hợp lệ'),
      status: 400,
      title: 'Bad Request',
      detail: 'Con trỏ phân trang không hợp lệ',
    },
    {
      name: 'errorToProblem_returns404_whenNotFoundError',
      error: new NotFoundError('Không tìm thấy sản phẩm gpu-x'),
      status: 404,
      title: 'Not Found',
      detail: 'Không tìm thấy sản phẩm gpu-x',
    },
    {
      name: 'errorToProblem_returns409_whenConflictError',
      error: new ConflictError('Đơn hàng đã tồn tại'),
      status: 409,
      title: 'Conflict',
      detail: 'Đơn hàng đã tồn tại',
    },
  ])('$name', ({ error, status, title, detail }) => {
    // Act
    const res = errorToProblem(error, 'req-1');

    // Assert
    expect(res.statusCode).toBe(status);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
    expect(parseBody(res)).toEqual({
      type: 'about:blank',
      title,
      status,
      detail,
      traceId: 'req-1',
    });
  });

  it('errorToProblem_returns500WithoutDetail_whenErrorIsUnexpected', () => {
    // Arrange
    const error = new Error('connect ECONNREFUSED 10.0.0.1:443');

    // Act
    const res = errorToProblem(error, 'req-2');

    // Assert
    expect(res.statusCode).toBe(500);
    expect(parseBody(res)).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      traceId: 'req-2',
    });
    expect(res.body).not.toContain('ECONNREFUSED');
  });
});

describe('validationProblem', () => {
  it('validationProblem_returns400WithFieldErrors_whenSchemaFails', () => {
    // Arrange
    const schema = z.object({
      id: z.string().min(3, 'id quá ngắn'),
      item: z.object({ quantity: z.number() }),
    });
    const parsed = schema.safeParse({ id: 'a', item: { quantity: 'hai' } });
    if (parsed.success) throw new Error('dữ liệu mẫu phải sai');

    // Act
    const res = validationProblem(parsed.error, 'req-3');

    // Assert
    expect(res.statusCode).toBe(400);
    expect(res.headers?.['content-type']).toBe('application/problem+json');
    expect(parseBody(res)).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail: 'Dữ liệu gửi lên không hợp lệ',
      traceId: 'req-3',
      errors: [
        { field: 'id', message: 'id quá ngắn' },
        { field: 'item.quantity', message: expect.any(String) },
      ],
    });
  });
});
