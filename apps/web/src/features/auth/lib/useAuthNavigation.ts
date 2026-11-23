import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifyAuthChanged } from '../../../shared/auth/token';
import { continueAfterSignIn } from '../../cart/lib/afterSignIn';

export interface AuthState {
  from?: string;
  reason?: string;
  /** Email đang gõ, mang qua lại giữa /login và /forgot-password (dang-nhap.md §1) */
  email?: string;
  /** Thông báo thành công khi về /login, vd. sau khi đặt lại mật khẩu (§3.1) */
  notice?: string;
}

/**
 * Hợp đồng với các trang khác (dang-nhap.md §1, §8): đọc `from`, `reason` từ state, chuyển tiếp
 * nguyên cho nhau giữa /login, /register, /forgot-password; xong thì báo đăng nhập rồi để giỏ hàng quyết đi đâu.
 */
export function useAuthNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const incoming = (location.state as AuthState | null) ?? {};
  const from = incoming.from ?? '/products';
  // Chỉ chuyển tiếp from, reason cho trang khác; email, notice chỉ dùng một lần ở trang nhận
  const state = useMemo<AuthState>(
    () => ({ from: incoming.from, reason: incoming.reason }),
    [incoming.from, incoming.reason],
  );

  return {
    state,
    email: incoming.email,
    notice: incoming.notice,
    from,
    reasonIsCheckout: state.reason === 'checkout',
    finish: async () => {
      notifyAuthChanged();
      await continueAfterSignIn(navigate, queryClient, from);
    },
  };
}
