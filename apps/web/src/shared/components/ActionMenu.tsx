import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { MoreHorizontal, type LucideIcon } from 'lucide-react';
import styles from './ActionMenu.module.css';

export interface ActionMenuItem {
  label: string;
  icon?: LucideIcon;
  /** Gọi sau khi menu đóng. Chuyển trang thì trang tự gọi navigate */
  onSelect: () => void;
  /** 'danger': chữ và icon màu đỏ (vd. "Xoá") */
  tone?: 'default' | 'danger';
  /** Kẻ một vạch phía trên mục này (tách mục nguy hiểm khỏi các mục khác) */
  separatorBefore?: boolean;
}

interface ActionMenuProps {
  /** Tên đọc của nút ba chấm, nên kèm đối tượng, vd. "Thao tác khác: Card RTX 4060" */
  label: string;
  items: readonly ActionMenuItem[];
  /** Icon của nút; mặc định ba chấm ngang */
  icon?: ReactNode;
  disabled?: boolean;
}

/**
 * Nút ba chấm mở menu thao tác (design-system §9.32), theo mẫu menu button của ARIA:
 * - nút `aria-haspopup="menu"`, `aria-expanded`; menu `role="menu"`, mục `role="menuitem"`;
 * - mở bằng bấm, Enter, Space, mũi tên xuống (focus mục đầu) hoặc mũi tên lên (focus mục cuối);
 * - trong menu: mũi tên lên, xuống đi vòng; Home, End; Esc đóng và trả focus về nút; Tab đóng;
 * - bấm ra ngoài thì đóng; chọn mục thì đóng, trả focus về nút rồi mới gọi `onSelect`.
 */
export function ActionMenu({ label, items, icon, disabled = false }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Mục nhận focus khi menu vừa mở: 0 là đầu, -1 là cuối
  const focusOnOpen = useRef<0 | -1>(0);
  const menuId = useId();

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  const focusItem = (index: number) => {
    const count = items.length;
    if (count === 0) return;
    itemRefs.current[((index % count) + count) % count]?.focus();
  };

  // Mở: focus mục đầu hoặc cuối; bấm ra ngoài thì đóng (không kéo focus về nút)
  useEffect(() => {
    if (!open) return;
    const rendered = itemRefs.current.filter(Boolean);
    (focusOnOpen.current === 0 ? rendered[0] : rendered[rendered.length - 1])?.focus();
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, close]);

  const openWith = (target: 0 | -1) => {
    focusOnOpen.current = target;
    setOpen(true);
  };

  const onButtonKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openWith(0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openWith(-1);
    }
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusItem(current + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusItem(current - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusItem(0);
        break;
      case 'End':
        event.preventDefault();
        focusItem(items.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        close(true);
        break;
      case 'Tab':
        close(false);
        break;
    }
  };

  const select = (item: ActionMenuItem) => {
    close(true);
    item.onSelect();
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={disabled}
        onClick={() => (open ? close(false) : openWith(0))}
        onKeyDown={onButtonKeyDown}
      >
        {icon ?? <MoreHorizontal size={20} aria-hidden="true" />}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={styles.menu}
          onKeyDown={onMenuKeyDown}
        >
          {items.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} role="none">
                {item.separatorBefore && index > 0 && (
                  <div role="separator" className={styles.separator} />
                )}
                <button
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={`${styles.item} ${item.tone === 'danger' ? styles.danger : ''}`}
                  onClick={() => select(item)}
                >
                  {Icon && <Icon size={18} aria-hidden="true" />}
                  {item.label}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
