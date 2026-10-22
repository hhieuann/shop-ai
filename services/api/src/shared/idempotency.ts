import {
  IdempotencyAlreadyInProgressError,
  IdempotencyConfig,
  IdempotencyValidationError,
  makeIdempotent,
} from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import type { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import type { Context } from 'aws-lambda';
import { BadRequestError, ConflictError, UnprocessableError } from './errors.js';

/**
 * Chống xử lý hai lần cho các API ghi nhận header Idempotency-Key (ADR-0017):
 * POST /cart/merge, POST /orders. Mỗi module truyền bảng idempotency của chính nó.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Đọc header Idempotency-Key (UUID do client sinh). Thiếu hoặc sai dạng thì 400. */
export function parseIdempotencyKey(headers: Readonly<Record<string, string | undefined>>): string {
  const raw = headers['idempotency-key'];
  if (!raw || !UUID.test(raw)) {
    throw new BadRequestError('Cần header Idempotency-Key dạng UUID');
  }
  return raw.toLowerCase();
}

export interface IdempotentRequest<P> {
  /** `sub` trong token: hai người trùng khoá không dùng chung kết quả */
  readonly userId: string;
  readonly idempotencyKey: string;
  /** Nội dung request; cùng khoá mà nội dung khác thì 422 */
  readonly payload: P;
}

export interface IdempotentResult<R> {
  readonly value: R;
  /** true khi trả lại kết quả đã lưu, vd. POST /orders trả 200 thay vì 201 */
  readonly replayed: boolean;
}

export interface IdempotencyOptions {
  readonly tableName: string;
  /** Mã lỗi 409 khi lần gửi trước cùng khoá chưa xong, vd. ORDER_IN_PROGRESS */
  readonly inProgressCode: string;
  /** Mặc định client mới; test truyền client của DynamoDB Local */
  readonly client?: DynamoDBClient;
}

const EXPIRES_AFTER_SECONDS = 24 * 60 * 60;

/**
 * Bọc một use case để gọi lại cùng khoá trả lại kết quả cũ thay vì chạy lần nữa.
 * Use case lỗi thì không lưu gì, khách thử lại cùng khoá được.
 * Payload và kết quả phải chuyển được sang JSON (Powertools băm payload và lưu kết quả vào bảng).
 */
export function makeIdempotentUseCase<P, R>(
  useCase: (payload: P, userId: string) => Promise<R>,
  options: IdempotencyOptions,
): (request: IdempotentRequest<P>, context?: Context) => Promise<IdempotentResult<R>> {
  const config = new IdempotencyConfig({
    eventKeyJmesPath: '[userId, idempotencyKey]',
    payloadValidationJmesPath: 'payload',
    throwOnNoIdempotencyKey: true,
    expiresAfterSeconds: EXPIRES_AFTER_SECONDS,
    // Chỉ chạy khi trả lại kết quả đã lưu: đánh dấu để handler biết
    responseHook: (response) => ({ ...(response as object), replayed: true }),
  });
  const persistenceStore = new DynamoDBPersistenceLayer({
    tableName: options.tableName,
    ...(options.client ? { awsSdkV3Client: options.client } : {}),
  });

  const run = makeIdempotent(
    async (request: IdempotentRequest<P>) => ({
      value: await useCase(request.payload, request.userId),
    }),
    { persistenceStore, config },
  );

  return async (request, context) => {
    // Có context thì lần chạy bị cắt ngang (timeout) sẽ hết hạn IN_PROGRESS cùng Lambda,
    // không khoá khách tới 24 giờ
    if (context) config.registerLambdaContext(context);
    try {
      const result = (await run(request)) as { value: R; replayed?: boolean };
      return { value: result.value, replayed: result.replayed === true };
    } catch (error) {
      if (error instanceof IdempotencyValidationError) {
        throw new UnprocessableError('Idempotency-Key đã dùng cho nội dung khác', {
          code: 'IDEMPOTENCY_KEY_REUSED',
        });
      }
      if (error instanceof IdempotencyAlreadyInProgressError) {
        throw new ConflictError('Lần gửi trước với cùng Idempotency-Key chưa xong, thử lại sau', {
          code: options.inProgressCode,
        });
      }
      throw error;
    }
  };
}
