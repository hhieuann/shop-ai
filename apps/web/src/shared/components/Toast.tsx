import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { ToastContext, type Toaster } from './toastContext';
import styles from './Toast.module.css';

/** Thời gian hiện trước khi tự ẩn (design-system §9.33) */
export const TOAST_DURATION_MS = 5000;

interface Message {
  /** Tăng mỗi lần gửi: câu trùng câu trước vẫn được đọc lại và đếm giờ lại */
  id: number;
  text: string;
}

/**
 * Thông báo nổi ở góc dưới (design-system §9.33). Đặt một lần ở cấp trang; con gọi `useToast()`.
 * - Vùng `role="status"` (đọc nhẹ) luôn có trên trang để trình đọc màn hình nhận câu mới.
 * - Tự ẩn sau 5 giây; rê chuột hoặc focus vào thông báo thì dừng đếm, rời ra thì đếm lại từ đầu.
 * - Có nút đóng; không dời focus của người dùng.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [paused, setPaused] = useState(false);
  const counter = useRef(0);

  const dismiss = useCallback(() => setMessage(null), []);
  const toaster = useMemo<Toaster>(
    () => ({ show: (text) => setMessage({ id: ++counter.current, text }) }),
    [],
  );

  useEffect(() => {
    if (!message || paused) return;
    const timer = setTimeout(dismiss, TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message, paused, dismiss]);

  return (
    <ToastContext.Provider value={toaster}>
      {children}
      {createPortal(
        <div className={styles.region} role="status" aria-live="polite" aria-atomic="true">
          {message && (
            <div
              key={message.id}
              className={styles.toast}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
              onFocus={() => setPaused(true)}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setPaused(false);
                }
              }}
            >
              <p className={styles.text}>{message.text}</p>
              <button
                type="button"
                className={styles.close}
                aria-label="Đóng thông báo"
                onClick={() => {
                  setPaused(false);
                  dismiss();
                }}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}
