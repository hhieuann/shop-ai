import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronRight } from 'lucide-react';
import { balancedColumns } from '../lib/specGrid';
import type { SpecEntry } from '../lib/specLabels';
import styles from './SpecTiles.module.css';

/** Khoảng cách giữa các ô (8px), phải khớp `gap` trong SpecTiles.module.css */
const TILE_GAP = 8;

/**
 * Ô thông số của trang chi tiết (design-system §9.24, pages/chi-tiet-san-pham.md §3.5).
 * Số cột chia đều theo hàng: đo bề rộng danh sách và `--spec-tile-min`, tính bằng `balancedColumns`.
 * Bấm một ô gọi `onOpen` với vị trí ô và chính nút đó (để panel trả focus về sau khi đóng).
 */
export function SpecTiles({
  rows,
  onOpen,
}: {
  rows: readonly SpecEntry[];
  onOpen: (index: number, button: HTMLButtonElement) => void;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const count = rows.length;
  // Chưa đo được bề rộng (trước lần đo đầu, môi trường test không có layout): tối đa 2 cột
  const [cols, setCols] = useState(() => balancedColumns(count, 0, 0, TILE_GAP));

  // Đo lần đầu trước khi trình duyệt vẽ (useLayoutEffect): không có khung hình 2 cột rồi mới đổi
  // số cột, khối thông số không đổi chiều cao sau khi hiện nên phần bên dưới không bị đẩy (CLS)
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const minTile = parseFloat(getComputedStyle(list).getPropertyValue('--spec-tile-min')) || 0;
      // setState với cùng giá trị thì React bỏ qua, không vẽ lại
      setCols(balancedColumns(count, list.clientWidth, minTile, TILE_GAP));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [count]);

  if (count === 0) return null;

  return (
    <ul ref={listRef} className={styles.list} style={{ '--spec-cols': cols } as CSSProperties}>
      {rows.map((row, index) => (
        <li key={row.key}>
          <button
            type="button"
            className={styles.tile}
            aria-haspopup="dialog"
            onClick={(e) => onOpen(index, e.currentTarget)}
          >
            <span className={styles.text}>
              <span className={styles.label}>{row.label}</span>{' '}
              <span className={styles.value} title={row.value}>
                {row.value}
              </span>
            </span>
            <ChevronRight size={18} className={styles.arrow} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
