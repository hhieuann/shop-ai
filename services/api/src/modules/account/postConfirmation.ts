import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { logger } from '../../shared/logger.js';

/** Thu hồi mọi phiên (refresh token) của một người dùng trong user pool. */
export interface SessionRevoker {
  signOutEverywhere(userPoolId: string, username: string): Promise<void>;
}

/**
 * Trigger Post confirmation của Cognito (threat model L9). Cognito không tự thu hồi refresh token khi
 * đặt lại mật khẩu (thử trên dev 11/11), nên kẻ đã đăng nhập bằng mật khẩu bị lộ vẫn dùng tiếp phiên tới
 * 30 ngày. Khi khách đặt lại mật khẩu xong thì đăng xuất mọi thiết bị.
 *
 * Trigger này cũng chạy khi xác nhận đăng ký (`PostConfirmation_ConfirmSignUp`): lúc đó chưa có phiên
 * nào nên bỏ qua. Lỗi thì ném ra để Lambda ghi Errors và web báo lỗi, thay vì im lặng để phiên cũ còn sống.
 * Access token đã cấp vẫn dùng được tới khi hết hạn (tối đa 1 giờ), vì JWT authorizer chỉ kiểm chữ ký.
 */
export function makePostConfirmationHandler(deps: { readonly sessions: SessionRevoker }) {
  return async (event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent> => {
    if (event.triggerSource !== 'PostConfirmation_ConfirmForgotPassword') return event;
    await deps.sessions.signOutEverywhere(event.userPoolId, event.userName);
    // Không log username hay email: chỉ cần biết đã thu hồi
    logger.info('Đã đăng xuất mọi thiết bị sau khi đặt lại mật khẩu');
    return event;
  };
}
