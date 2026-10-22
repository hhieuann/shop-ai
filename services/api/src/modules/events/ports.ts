import type { StoredEvent } from './domain/event.js';

/** Use case chỉ biết interface này; adapter DynamoDB nằm trong infra/. */
export interface EventRepository {
  put(event: StoredEvent): Promise<void>;
}

/**
 * Băm userId trước khi lưu (events.md mục 2). Cùng userId và cùng khoá luôn ra cùng giá trị,
 * nên pipeline vẫn gom được sự kiện theo người mà không biết người đó là ai.
 */
export interface UserIdHasher {
  hash(userId: string): Promise<string>;
}
