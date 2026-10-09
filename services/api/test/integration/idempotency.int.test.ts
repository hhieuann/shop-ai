import { CreateTableCommand } from '@aws-sdk/client-dynamodb';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConflictError, UnprocessableError } from '../../src/shared/errors.js';
import { makeIdempotentUseCase } from '../../src/shared/idempotency.js';
import { startDynamoLocal, type DynamoLocal } from '../helpers/dynamo.js';

const TABLE = 'cart-idempotency-test';
let dynamo: DynamoLocal;

beforeAll(async () => {
  dynamo = await startDynamoLocal();
  // Đúng schema ADR-0017: khoá chính `id`, TTL trên `expiration` (CDK bật TTL, DynamoDB Local bỏ qua)
  await dynamo.client.send(
    new CreateTableCommand({
      TableName: TABLE,
      AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
      KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
      BillingMode: 'PAY_PER_REQUEST',
    }),
  );
});

afterAll(async () => {
  await dynamo?.stop();
});

interface MergeInput {
  readonly items: { productId: string; quantity: number }[];
}

function setup(useCase = vi.fn(async (payload: MergeInput) => ({ lines: payload.items.length }))) {
  const merge = makeIdempotentUseCase(useCase, {
    tableName: TABLE,
    client: dynamo.client,
    inProgressCode: 'MERGE_IN_PROGRESS',
  });
  return { merge, useCase };
}

const payload: MergeInput = { items: [{ productId: 'gpu-rtx4070', quantity: 1 }] };

describe('makeIdempotentUseCase', () => {
  it('returnsSameResultWithoutRunningAgain_whenSameKeyAndPayload', async () => {
    // Arrange
    const { merge, useCase } = setup();
    const request = { userId: 'user-1', idempotencyKey: 'key-same', payload };

    // Act
    const first = await merge(request);
    const second = await merge(request);

    // Assert
    expect(first).toEqual({ value: { lines: 1 }, replayed: false });
    expect(second).toEqual({ value: { lines: 1 }, replayed: true });
    expect(useCase).toHaveBeenCalledTimes(1);
    expect(useCase).toHaveBeenCalledWith(payload, 'user-1');
  });

  it('throwsUnprocessableWithCode_whenSameKeyButPayloadDiffers', async () => {
    // Arrange
    const { merge } = setup();
    await merge({ userId: 'user-1', idempotencyKey: 'key-reused', payload });
    const otherPayload: MergeInput = { items: [{ productId: 'psu-750w', quantity: 2 }] };

    // Act
    const act = merge({ userId: 'user-1', idempotencyKey: 'key-reused', payload: otherPayload });

    // Assert
    await expect(act).rejects.toBeInstanceOf(UnprocessableError);
    await expect(act).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });

  it('runsAgain_whenSameKeyFromAnotherUser', async () => {
    // Arrange: khoá do client sinh, hai người trùng khoá không được dính kết quả của nhau
    const { merge, useCase } = setup();

    // Act
    await merge({ userId: 'user-a', idempotencyKey: 'key-shared', payload });
    const other = await merge({ userId: 'user-b', idempotencyKey: 'key-shared', payload });

    // Assert
    expect(other.replayed).toBe(false);
    expect(useCase).toHaveBeenCalledTimes(2);
  });

  it('throwsConflictWithCode_whenFirstRequestStillRunning', async () => {
    // Arrange: lần đầu báo đã bắt đầu rồi treo cho tới khi test cho chạy tiếp.
    // Powertools chỉ gọi use case sau khi ghi xong bản ghi IN_PROGRESS, nên chờ `started` là chắc chắn
    // lần gọi sau sẽ thấy IN_PROGRESS, không đua nhau ghi bản ghi.
    let markStarted: () => void = () => undefined;
    const started = new Promise<void>((resolve) => {
      markStarted = resolve;
    });
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { merge } = setup(
      vi.fn(async () => {
        markStarted();
        await gate;
        return { lines: 1 };
      }),
    );
    const request = { userId: 'user-1', idempotencyKey: 'key-slow', payload };
    const first = merge(request);
    await started;

    // Act: gửi lại trong lúc lần đầu chưa xong
    const second = merge(request);

    // Assert
    await expect(second).rejects.toBeInstanceOf(ConflictError);
    await expect(second).rejects.toMatchObject({ code: 'MERGE_IN_PROGRESS' });
    release();
    await expect(first).resolves.toEqual({ value: { lines: 1 }, replayed: false });
  });

  it('runsAgain_whenUseCaseFailed', async () => {
    // Arrange: lỗi thì không lưu kết quả, khách thử lại cùng khoá được
    const useCase = vi
      .fn<(payload: MergeInput) => Promise<{ lines: number }>>()
      .mockRejectedValueOnce(new Error('DynamoDB tạm lỗi'))
      .mockResolvedValueOnce({ lines: 1 });
    const { merge } = setup(useCase);
    const request = { userId: 'user-1', idempotencyKey: 'key-retry', payload };

    // Act
    await expect(merge(request)).rejects.toThrow('DynamoDB tạm lỗi');
    const retry = await merge(request);

    // Assert
    expect(retry).toEqual({ value: { lines: 1 }, replayed: false });
  });
});
