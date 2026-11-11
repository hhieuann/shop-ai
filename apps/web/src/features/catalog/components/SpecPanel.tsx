import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type TransitionEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { ProductCategory } from '../../../shared/api/types';
import { trapTabKey } from '../../../shared/lib/focusTrap';
import { specHelp } from '../lib/specHelp';
import type { SpecEntry } from '../lib/specLabels';
import styles from './SpecPanel.module.css';

/**
 * Sau khi vừa mở hay bấm mục lục: chờ thân cuộn xong (sự kiện scrollend) mới đổi mục đang xem theo
 * kết quả theo dõi. Không có scrollend (trình duyệt cũ, vị trí không đổi) thì hết khoảng này (ms)
 * coi như đã cuộn xong
 */
const SCROLL_END_FALLBACK_MS = 1000;
/** Dự phòng khi không có transitionend (giảm chuyển động, môi trường test): gỡ panel sau khoảng này */
const CLOSE_FALLBACK_MS = 250;

interface SpecPanelProps {
  category: ProductCategory;
  rows: readonly SpecEntry[];
  /** Thông số vừa bấm: mở ra là thấy ngay phần này */
  initialIndex: number;
  /** Phần tử đã mở panel (ô thông số); đóng xong focus về đây */
  opener: HTMLElement | null;
  /** Gọi sau khi panel đã trượt ra; trang gỡ panel */
  onClose: () => void;
}

/**
 * Panel thông số mở từ bên phải (design-system §9.24, pages/chi-tiet-san-pham.md §3.6).
 * Trang chỉ render khi đang mở. Hộp thoại modal: khoá cuộn trang nền, giữ focus trong panel,
 * Esc / nút Đóng / bấm vùng tối thì trượt ra rồi gỡ, trả focus về ô đã mở.
 */
export function SpecPanel({ category, rows, initialIndex, opener, onClose }: SpecPanelProps) {
  const titleId = useId();
  const sectionId = useId();
  const frameRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const spacerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // Mục đang cuộn tới (vừa mở hay vừa bấm mục lục); khác null thì chưa đổi mục theo kết quả theo dõi
  const jumpTarget = useRef<number | null>(null);
  // Các phần đang thấy trong vùng theo dõi; luôn cập nhật, kể cả lúc đang chờ cuộn xong
  const visible = useRef(new Set<number>());
  const jumpFallback = useRef<ReturnType<typeof setTimeout>>();
  const closing = useRef(false);

  // closed: ngoài màn hình; open: đã trượt vào. Khung hình sau khi gắn mới đổi sang open để có chuyển động
  const [state, setState] = useState<'closed' | 'open'>('closed');
  const [active, setActive] = useState(initialIndex);

  // Đóng: trượt ra rồi mới báo trang gỡ; chỉ báo một lần
  const finish = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    onClose();
  }, [onClose]);
  const fallback = useRef<ReturnType<typeof setTimeout>>();
  const closeRequested = useRef(false);
  const requestClose = useCallback(() => {
    // Bấm đóng lần hai (vd. Esc rồi bấm vùng tối) khi đang trượt ra thì bỏ qua: chỉ một hẹn giờ
    if (closeRequested.current) return;
    closeRequested.current = true;
    setState('closed');
    clearTimeout(fallback.current);
    fallback.current = setTimeout(finish, CLOSE_FALLBACK_MS);
  }, [finish]);
  useEffect(() => () => clearTimeout(fallback.current), []);

  const onTransitionEnd = (e: TransitionEvent<HTMLDivElement>) => {
    if (state === 'closed' && e.target === frameRef.current && e.propertyName === 'transform') {
      finish();
    }
  };

  // Khoảng trống cuối nội dung: đủ để phần cuối cùng cũng cuộn lên được đầu thân.
  // Đặt thẳng lên DOM để có ngay trước khi cuộn tới thông số vừa bấm (state thì chậm một lượt vẽ)
  const measureSpacer = useCallback(() => {
    const content = contentRef.current;
    const last = sectionRefs.current[rows.length - 1];
    const spacer = spacerRef.current;
    if (!content || !last || !spacer) return;
    spacer.style.height = `${Math.max(0, content.clientHeight - last.offsetHeight)}px`;
  }, [rows.length]);

  // Thân cuộn xong: đánh dấu phần trên cùng đang thấy. Người dùng tự cuộn giữa chừng thì ra phần
  // đang xem; dừng đúng ở mục đã chọn thì cũng ra mục đó. Không thấy phần nào thì giữ mục đã chọn
  const endJump = useCallback(() => {
    clearTimeout(jumpFallback.current);
    if (jumpTarget.current === null) return;
    const seen = visible.current;
    setActive(seen.size > 0 ? Math.min(...seen) : jumpTarget.current);
    jumpTarget.current = null;
  }, []);
  // Bắt đầu cuộn tới một mục; chọn mục khác giữa chừng thì huỷ lượt chờ cũ
  const startJump = useCallback(
    (index: number) => {
      setActive(index);
      jumpTarget.current = index;
      clearTimeout(jumpFallback.current);
      jumpFallback.current = setTimeout(endJump, SCROLL_END_FALLBACK_MS);
    },
    [endJump],
  );
  useEffect(() => {
    const content = contentRef.current;
    content?.addEventListener('scrollend', endJump);
    return () => {
      content?.removeEventListener('scrollend', endJump);
      clearTimeout(jumpFallback.current);
    };
  }, [endJump]);

  // Mở: cuộn ngay (không trượt) tới thông số vừa bấm, đánh dấu mục, focus nút đóng
  useLayoutEffect(() => {
    measureSpacer();
    const content = contentRef.current;
    const section = sectionRefs.current[initialIndex];
    if (content && section) content.scrollTop = section.offsetTop;
    startJump(initialIndex);
    closeRef.current?.focus();
    const frame = requestAnimationFrame(() => setState('open'));
    return () => cancelAnimationFrame(frame);
  }, [initialIndex, measureSpacer, startJump]);

  // Gỡ xong: trả focus về ô đã mở
  useEffect(() => () => opener?.focus(), [opener]);

  // Khoá cuộn trang nền trong lúc panel mở
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = previous;
    };
  }, []);

  // Esc đóng panel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);

  // Đổi kích thước cửa sổ: đo lại khoảng trống cuối
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measureSpacer);
    observer.observe(content);
    return () => observer.disconnect();
  }, [measureSpacer]);

  // Theo dõi khi cuộn: phần trên cùng đang thấy (trong 40% trên của thân) thành mục đang xem.
  // rootMargin -1px ở trên: phần trước chỉ chạm mép trên (diện tích 0) không tính là đang thấy
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof IntersectionObserver === 'undefined') return;
    const seen = visible.current;
    seen.clear();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (entry.isIntersecting) seen.add(index);
          else seen.delete(index);
        }
        if (jumpTarget.current !== null || seen.size === 0) return;
        setActive(Math.min(...seen));
      },
      { root: content, rootMargin: '-1px 0px -60% 0px' },
    );
    for (const section of sectionRefs.current) if (section) observer.observe(section);
    return () => observer.disconnect();
  }, [rows.length]);

  // Điện thoại: tab đang xem luôn nằm trong tầm nhìn của hàng tab
  useEffect(() => {
    tabRefs.current[active]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  const goTo = (index: number) => {
    startJump(index);
    const content = contentRef.current;
    const section = sectionRefs.current[index];
    if (!content || !section) return;
    const smooth = !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (content.scrollTo) {
      content.scrollTo({ top: section.offsetTop, behavior: smooth ? 'smooth' : 'auto' });
    } else {
      content.scrollTop = section.offsetTop;
    }
  };

  return createPortal(
    <>
      <div className={styles.scrim} data-state={state} onClick={requestClose} aria-hidden="true" />
      <div
        ref={frameRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={styles.frame}
        data-state={state}
        onKeyDown={(e) => trapTabKey(e, frameRef.current)}
        onTransitionEnd={onTransitionEnd}
      >
        <div className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Thông số kỹ thuật
          </h2>
          <button
            ref={closeRef}
            type="button"
            className={styles.close}
            aria-label="Đóng"
            onClick={requestClose}
          >
            <X size={24} aria-hidden="true" />
          </button>
        </div>

        <div className={styles.body}>
          <nav className={`${styles.toc} scroll-area`} aria-label="Các thông số">
            <ul className={styles.tocList}>
              {rows.map((row, index) => (
                <li key={row.key}>
                  <button
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    className={styles.tocItem}
                    aria-current={index === active ? 'true' : undefined}
                    onClick={() => goTo(index)}
                  >
                    {row.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div ref={contentRef} className={`${styles.content} scroll-area`}>
            {rows.map((row, index) => {
              const help = specHelp(category, row.key);
              const headingId = `${sectionId}-${index}`;
              return (
                <section
                  key={row.key}
                  ref={(el) => {
                    sectionRefs.current[index] = el;
                  }}
                  data-index={index}
                  className={styles.section}
                  aria-labelledby={headingId}
                >
                  <h3 id={headingId} className={styles.sectionTitle}>
                    {row.label}
                  </h3>
                  <div className={styles.valueBox}>
                    <span className={styles.value}>{row.value}</span>
                    <span className={styles.badge}>Sản phẩm này</span>
                  </div>
                  {help ? (
                    <p className={styles.help}>{help}</p>
                  ) : (
                    <p className={`${styles.help} ${styles.noHelp}`}>
                      Chưa có phần giải thích cho thông số này.
                    </p>
                  )}
                </section>
              );
            })}
            <div ref={spacerRef} aria-hidden="true" />
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
