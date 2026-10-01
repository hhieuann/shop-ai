/**
 * Lỗi nghiệp vụ dùng chung. Mỗi module tạo class riêng kế thừa từ đây (vd. ProductNotFoundError).
 * Lỗi chỉ nói "loại lỗi gì"; việc đổi sang HTTP status nằm ở một chỗ duy nhất trong shared/http.
 */
export type ErrorKind = 'NOT_FOUND' | 'CONFLICT';

export abstract class AppError extends Error {
  abstract readonly kind: ErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  readonly kind = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  readonly kind = 'CONFLICT';
}
