import { useEffect, useId, useRef, type ReactNode } from 'react';
import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  title: string;
  /** Nội dung giải thích, 14/20 `--fg-muted` */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Chữ nút chính lúc đang xử lý, vd. "Đang chuyển…" (design-system §9.3) */
  busyLabel: string;
  busy?: boolean;
  /** Thông báo lỗi (thường là `Alert`) hiện trên hàng nút */
  error?: ReactNode;
  onConfirm: () => void;
  /** Bấm nút phụ, phím Esc: đóng hộp thoại. Không gọi khi đang xử lý */
  onClose: () => void;
}

/**
 * Hộp thoại xác nhận (design-system §9.14): `<dialog>` gốc của trình duyệt mở bằng showModal nên tự
 * giữ focus trong hộp, Esc để đóng, nền sau là `::backdrop`. Component có mặt thì hộp mở; muốn đóng
 * thì trang bỏ component đi. Nút chính đặt cuối hàng (điện thoại xếp lên trên).
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  busyLabel,
  busy = false,
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(event) => {
        // Esc: tự đóng theo trình duyệt sẽ lệch với state của trang, nên để trang quyết
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id={titleId} className={styles.title}>
        {title}
      </h2>
      <div id={bodyId} className={styles.body}>
        {children}
      </div>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={onConfirm}
          aria-busy={busy}
          disabled={busy}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
