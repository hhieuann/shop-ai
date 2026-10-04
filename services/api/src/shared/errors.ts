/**
 * Lỗi nghiệp vụ dùng chung. Mỗi module tạo class riêng kế thừa từ đây (vd. ProductNotFoundError).
 * Lỗi chỉ nói "loại lỗi gì"; việc đổi sang HTTP status nằm ở một chỗ duy nhất trong shared/http.
 */
export type ErrorKind = 'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT';

export abstract class AppError extends Error {
  abstract readonly kind: ErrorKind;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input đúng kiểu nhưng sai về nghiệp vụ, vd. cursor phân trang không giải mã được. Lỗi kiểu dữ liệu thì dùng validationProblem. */
export class BadRequestError extends AppError {
  readonly kind = 'BAD_REQUEST';
}

export class NotFoundError extends AppError {
  readonly kind = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  readonly kind = 'CONFLICT';
}
