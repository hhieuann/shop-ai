import { useEffect, useState } from 'react';
import { getAccessToken, getUserProfile, onAuthChange, type UserProfile } from './token';

/** 'loading': đang hỏi token (lần đầu mở trang); 'guest': chưa đăng nhập; 'signedIn': đã đăng nhập */
export type SessionStatus = 'loading' | 'guest' | 'signedIn';

/**
 * Trạng thái đăng nhập hiện tại, tự cập nhật khi đăng nhập hoặc đăng xuất (onAuthChange).
 * Chỉ biết "có token hay không"; phân quyền thật vẫn do API kiểm.
 */
export function useSession(): SessionStatus {
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getAccessToken().then((token) => {
        if (!cancelled) setStatus(token ? 'signedIn' : 'guest');
      });
    };
    refresh();
    const unsubscribe = onAuthChange(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return status;
}

export interface Account {
  status: SessionStatus;
  /** Có khi status = 'signedIn' và đã đọc được hồ sơ */
  user: UserProfile | null;
}

/** Trạng thái đăng nhập kèm username, email, quyền admin (nút tài khoản trên header) */
export function useAccount(): Account {
  const [account, setAccount] = useState<Account>({ status: 'loading', user: null });

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void Promise.all([getAccessToken(), getUserProfile()]).then(
        ([token, user]) => {
          if (cancelled) return;
          setAccount(token ? { status: 'signedIn', user } : { status: 'guest', user: null });
        },
        () => {
          if (!cancelled) setAccount({ status: 'guest', user: null });
        },
      );
    };
    refresh();
    const unsubscribe = onAuthChange(refresh);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return account;
}
