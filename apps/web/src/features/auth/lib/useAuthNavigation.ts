import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { notifyAuthChanged } from '../../../shared/auth/token';
import { continueAfterSignIn } from '../../cart/lib/afterSignIn';

export interface AuthState {
  from?: string;
  reason?: string;
}

/**
 * Hợp đồng với các trang khác (dang-nhap.md §1, §8): đọc `from`, `reason` từ state, chuyển tiếp
 * nguyên cho nhau giữa /login và /register; xong thì báo đăng nhập rồi để giỏ hàng quyết đi đâu.
 */
export function useAuthNavigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const state = (location.state as AuthState | null) ?? {};
  const from = state.from ?? '/products';

  return {
    state,
    from,
    reasonIsCheckout: state.reason === 'checkout',
    finish: async () => {
      notifyAuthChanged();
      await continueAfterSignIn(navigate, queryClient, from);
    },
  };
}
