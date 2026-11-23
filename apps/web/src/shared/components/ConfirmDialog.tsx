import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';
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
  /**
   * Kiểu nút xác nhận (§9.14): `primary` (mặc định, trang admin) hoặc `danger` cho việc không
   * hoàn tác được (huỷ đơn)
   */
  tone?: 'primary' | 'danger';
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
 *
 * Đóng hộp thì component tự trả focus về phần tử đã có focus lúc mở (nút đã mở hộp), nếu focus đang
 * lạc về `<body>` và phần tử đó còn trên trang. Trang chỉ tự chuyển focus khi nút đó biến mất hoặc nội
 * dung đổi hẳn (vd. focus `<h1>`); khi đó component không giành lại.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  busyLabel,
  busy = false,
  tone = 'primary',
  error,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    // Nhớ nút đã mở hộp. Safari, Firefox trên macOS không focus nút khi bấm chuột nên có thể là <body>:
    // khi đó không có gì để trả
    const active = document.activeElement;
    const opener = active instanceof HTMLElement && active !== document.body ? active : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      // React gỡ <dialog> khỏi trang trước khi chạy cleanup nên close() không trả được focus: tự trả ở
      // khung hình sau, chỉ khi focus đang lạc (trang chưa chủ động đặt focus chỗ khác)
      requestAnimationFrame(() => {
        const lost = document.activeElement === null || document.activeElement === document.body;
        if (lost && opener?.isConnected) opener.focus();
      });
    };
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
        {/* Nút phụ đứng trước trong DOM nên showModal focus nó trước: Enter nhầm chỉ đóng hộp */}
        <Button className={styles.action} onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button className={styles.action} variant={tone} onClick={onConfirm} busy={busy}>
          {busy ? busyLabel : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
