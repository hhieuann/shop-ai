import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { checkSignUp } from './application/checkSignUp.js';
import type { UserDirectory } from './ports.js';

/**
 * Trigger Pre sign-up của Cognito. Ném lỗi thì Cognito huỷ đăng ký và trả message cho web.
 * Không tự xác nhận tài khoản: khách vẫn nhập mã gửi email.
 */
export function makePreSignUpHandler(deps: { readonly users: UserDirectory }) {
  return async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> => {
    // Admin tạo user bằng console/CLI (vd. user cho E2E) không qua form đăng ký
    if (event.triggerSource === 'PreSignUp_AdminCreateUser') return event;
    await checkSignUp(deps, { username: event.request.userAttributes.preferred_username });
    return event;
  };
}
