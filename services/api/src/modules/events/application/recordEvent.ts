import { expiresAt, type ClientEventType, type StoredEvent } from '../domain/event.js';
import type { EventRepository, UserIdHasher } from '../ports.js';

export interface RecordEventDeps {
  readonly events: Pick<EventRepository, 'put'>;
  readonly hasher: UserIdHasher;
  readonly now: () => string;
  readonly newId: () => string;
}

export interface RecordEventInput {
  /** Cognito `sub` lấy từ JWT, không lấy từ body (events.md mục 5) */
  readonly userId: string;
  readonly productId: string;
  readonly eventType: ClientEventType;
}

/** Ghi một lượt xem hoặc thêm giỏ. Không kiểm productId có trong danh mục (ADR-0009, contract). */
export async function recordEvent(deps: RecordEventDeps, input: RecordEventInput): Promise<void> {
  const timestamp = deps.now();
  const event: StoredEvent = {
    userIdHash: await deps.hasher.hash(input.userId),
    eventId: deps.newId(),
    productId: input.productId,
    eventType: input.eventType,
    timestamp,
    ttl: expiresAt(timestamp),
  };
  await deps.events.put(event);
}
