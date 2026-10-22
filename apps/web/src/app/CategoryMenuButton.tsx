import { useCallback, useEffect, useId, useRef, useState, type FocusEvent } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, Package, X } from 'lucide-react';
import { CategoryMenu } from '../features/catalog/components/CategoryMenu';
import { DESKTOP_QUERY, useMediaQuery } from '../shared/hooks/useMediaQuery';
import { trapTabKey } from '../shared/lib/focusTrap';
import styles from './CategoryMenuButton.module.css';

/**
 * Nút "Danh mục" trên header (design-system §9.1, §9.18).
 * ≥1280px: bảng thả xuống dưới nút, vùng tối phủ dưới header (như menu tài khoản).
 * <1280px: chỉ icon; mở ngăn kéo từ trái có link "Đơn hàng" và 13 loại hàng.
 */
export function CategoryMenuButton() {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  // Đổi trang hoặc đổi giữa bản máy tính và điện thoại thì đóng
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search, desktop]);

  // Mở: khoá cuộn trang, focus mục đầu tiên, Esc để đóng
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    html.style.overflow = 'hidden';
    panelRef.current?.querySelector<HTMLElement>('[data-autofocus], nav a')?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') close(true);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      html.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  // Bảng thả xuống: Tab ra khỏi nút và bảng thì đóng (không đưa focus về nút)
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const next = e.relatedTarget as Node | null;
    if (open && desktop && next && !rootRef.current?.contains(next)) setOpen(false);
  };

  const onNavigate = () => close(false);

  return (
    <div className={styles.root} ref={rootRef} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label="Danh mục"
        onClick={() => setOpen((v) => !v)}
      >
        <Menu size={24} aria-hidden="true" />
        <span className={styles.label} aria-hidden="true">
          Danh mục
        </span>
      </button>

      {desktop ? (
        <>
          {/* Vùng tối phủ dưới header (header z-index 210 nằm trên) */}
          {createPortal(
            <div
              className={`${styles.scrim} ${open ? styles.scrimOpen : ''}`}
              onClick={() => close(true)}
              aria-hidden="true"
            />,
            document.body,
          )}
          {open && (
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="false"
              aria-label="Danh mục"
              className={styles.dropdown}
            >
              <CategoryMenu onNavigate={onNavigate} />
            </div>
          )}
        </>
      ) : (
        open &&
        createPortal(
          <>
            <div
              className={`${styles.scrim} ${styles.scrimTop} ${styles.scrimOpen}`}
              onClick={() => close(true)}
              aria-hidden="true"
            />
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label="Danh mục"
              className={styles.drawer}
              // Ngăn kéo là hộp thoại modal: Tab chỉ đi vòng trong ngăn kéo
              onKeyDown={(e) => trapTabKey(e, panelRef.current)}
            >
              <div className={styles.drawerHead}>
                <button
                  type="button"
                  className={styles.close}
                  onClick={() => close(true)}
                  aria-label="Đóng"
                >
                  <X size={24} aria-hidden="true" />
                </button>
              </div>
              {/* Trên điện thoại hàng 1 header không có nút Đơn hàng: đặt ở đầu ngăn kéo */}
              <NavLink to="/orders" className={styles.orders} onClick={onNavigate} data-autofocus>
                <span className={styles.tile} aria-hidden="true">
                  <Package size={20} aria-hidden="true" />
                </span>
                Đơn hàng
              </NavLink>
              <CategoryMenu framed={false} onNavigate={onNavigate} />
            </div>
          </>,
          document.body,
        )
      )}
    </div>
  );
}
