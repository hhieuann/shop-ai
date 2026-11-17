import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { trapTabKey } from '../../../shared/lib/focusTrap';
import type { AccountSection } from '../lib/sections';
import { AccountSectionList } from './AccountSectionList';
import styles from './AccountSectionSheet.module.css';

interface AccountSectionSheetProps {
  current: AccountSection['id'];
  /** returnFocus: đóng bằng ×, Esc, vùng tối thì trả focus về nút "Đổi mục"; chọn mục thì không */
  onClose: (returnFocus: boolean) => void;
  onSignOut: () => void;
}

/**
 * Bảng chọn mục tài khoản (<1280, design-system §9.27): trượt lên từ đáy, modal, giữ focus trong bảng,
 * khoá cuộn trang. Mở thì focus vào mục đang xem.
 */
export function AccountSectionSheet({ current, onClose, onSignOut }: AccountSectionSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(true);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <>
      <div className={styles.scrim} onClick={() => onClose(true)} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.sheet}
        onKeyDown={(e) => trapTabKey(e, panelRef.current)}
      >
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Tài khoản
          </h2>
          <button
            type="button"
            className={styles.close}
            onClick={() => onClose(true)}
            aria-label="Đóng"
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Tài khoản">
          <AccountSectionList
            current={current}
            size="sheet"
            onNavigate={() => onClose(false)}
            onSignOut={() => {
              onClose(false);
              onSignOut();
            }}
          />
        </nav>
      </div>
    </>,
    document.body,
  );
}
