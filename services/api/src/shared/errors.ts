/**
 * Lỗi nghiệp vụ dùng chung. Mỗi module tạo class riêng kế thừa từ đây (vd. ProductNotFoundError).
 * Lỗi chỉ nói "loại lỗi gì"; việc đổi sang HTTP status nằm ở một chỗ duy nhất trong shared/http.
 */
export type ErrorKind = 'BAD_REQUEST' | 'NOT_FOUND' | 'CONFLICT' | 'UNPROCESSABLE';

export interface AppErrorOptions {
  /** Mã lỗi nghiệp vụ cho frontend, trả trong trường `code` của Problem, vd. OUT_OF_STOCK */
  readonly code?: string;
}

export abstract class AppError extends Error {
  abstract readonly kind: ErrorKind;
  readonly code?: string;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    if (options.code !== undefined) this.code = options.code;
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

/** Request đúng cú pháp nhưng không xử lý được, vd. dùng lại Idempotency-Key cho nội dung khác. */
export class UnprocessableError extends AppError {
  readonly kind = 'UNPROCESSABLE';
}
