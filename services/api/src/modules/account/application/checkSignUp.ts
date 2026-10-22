import { validateUsername, type UsernameErrorCode } from '../domain/username.js';
import type { UserDirectory } from '../ports.js';

export type SignUpRejectCode = UsernameErrorCode | 'USERNAME_TAKEN';

/** Cognito đưa message của lỗi này cho web: "PreSignUp failed with error <code>." */
export class SignUpRejectedError extends Error {
  constructor(readonly code: SignUpRejectCode) {
    super(code);
    this.name = 'SignUpRejectedError';
  }
}

/** Kiểm username trước khi Cognito tạo tài khoản. Sai luật thì không cần hỏi danh bạ. */
export async function checkSignUp(
  deps: { readonly users: UserDirectory },
  input: { readonly username: string | undefined },
): Promise<void> {
  const check = validateUsername(input.username);
  if (!check.ok) throw new SignUpRejectedError(check.code);
  if (await deps.users.isUsernameTaken(check.value))
    throw new SignUpRejectedError('USERNAME_TAKEN');
}
