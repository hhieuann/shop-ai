import { Link, type To } from 'react-router-dom';
import styles from './CursorPager.module.css';

export interface PagerTarget {
  to: To;
  /** Đi kèm mục lịch sử, vd. cursor các trang trước (không lên URL) */
  state?: unknown;
}

interface CursorPagerProps {
  /** Trang đang xem, bắt đầu từ 1 */
  page: number;
  /** Không có thì "Trước" vô hiệu */
  previous?: PagerTarget;
  /** Không có (hết nextCursor) thì "Sau" vô hiệu */
  next?: PagerTarget;
  /** Gọi khi bấm Trước hoặc Sau, vd. để cuộn lên đầu và chuyển focus */
  onNavigate?: () => void;
}

/**
 * Chuyển trang "Trước · Trang N · Sau" (design-system §9.21). API trả nextCursor, không trả
 * tổng số, nên không có số trang tổng hay nút 1 2 3. Mỗi lần bấm là một mục lịch sử mới,
 * nút Back của trình duyệt cũng quay lại trang trước. Chỉ có 1 trang thì không hiện gì.
 */
export function CursorPager({ page, previous, next, onNavigate }: CursorPagerProps) {
  if (page <= 1 && !next) return null;

  return (
    <nav aria-label="Phân trang" className={styles.pager}>
      <PagerLink target={previous} label="Trang trước" onNavigate={onNavigate}>
        Trước
      </PagerLink>
      <span className={styles.current} aria-current="page">
        Trang {page}
      </span>
      <PagerLink target={next} label="Trang sau" onNavigate={onNavigate}>
        Sau
      </PagerLink>
    </nav>
  );
}

function PagerLink({
  target,
  label,
  onNavigate,
  children,
}: {
  target?: PagerTarget;
  label: string;
  onNavigate?: () => void;
  children: string;
}) {
  if (!target) {
    // Link vô hiệu: không có href nên không bấm, không Tab tới được
    return (
      <span role="link" aria-disabled="true" aria-label={label} className={styles.disabled}>
        {children}
      </span>
    );
  }
  return (
    <Link
      to={target.to}
      state={target.state}
      aria-label={label}
      className={styles.link}
      onClick={onNavigate}
    >
      {children}
    </Link>
  );
}
