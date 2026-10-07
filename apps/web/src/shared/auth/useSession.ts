import { useEffect, useState } from 'react';
import { getAccessToken, onAuthChange } from './token';

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
