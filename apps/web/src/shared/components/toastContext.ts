import { createContext, useContext } from 'react';

/** Gửi thông báo nổi (design-system §9.33). Để riêng file vì file component chỉ nên xuất component */
export interface Toaster {
  /** Hiện câu thông báo; câu mới thay câu đang hiện */
  show(message: string): void;
}

export const ToastContext = createContext<Toaster | null>(null);

/** Dùng trong cây có `ToastProvider`; thiếu provider là lỗi lập trình nên ném ra ngay */
export function useToast(): Toaster {
  const toaster = useContext(ToastContext);
  if (!toaster) throw new Error('useToast cần ToastProvider ở cấp trên');
  return toaster;
}
