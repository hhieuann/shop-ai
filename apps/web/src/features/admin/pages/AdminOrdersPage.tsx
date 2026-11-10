import { forwardRef, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type {
  AdminListStatus,
  AdminOrderList,
  AdminOrderSummary,
  AdminTargetStatus,
} from '../../../shared/api/types';
import { useRequireSignIn } from '../../../shared/auth/useRequireSignIn';
import { useAccount } from '../../../shared/auth/useSession';
import { Alert } from '../../../shared/components/Alert';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { CursorPager, type PagerTarget } from '../../../shared/components/CursorPager';
import { LiveAnnouncerProvider } from '../../../shared/components/LiveAnnouncer';
import { Price } from '../../../shared/components/Price';
import { useAnnounce } from '../../../shared/hooks/useAnnounce';
import { formatDateTime, formatVnd } from '../../../shared/lib/format';
import { STATUS_LABEL } from '../../orders/types';
import styles from './AdminOrdersPage.module.css';

/** Mỗi trang 20 đơn (mặc định của API) */
const PAGE_SIZE = 20;

/** Tab, bước tiếp theo và chữ trên nút, hộp thoại của từng trạng thái (pages/admin-don-hang.md §2, §3) */
const TABS: Record<
  AdminListStatus,
  {
    tab: string;
    next: AdminTargetStatus;
    action: string;
    dialogTitle: string;
    dialogNote: string;
    empty: string;
    done: string;
  }
> = {
  CONFIRMED: {
    tab: 'Chờ giao',
    next: 'SHIPPED',
    action: 'Chuyển sang Đang giao',
    dialogTitle: 'Chuyển đơn sang Đang giao?',
    dialogNote: 'Sau khi chuyển, khách không tự huỷ đơn này được nữa.',
    empty: 'Không có đơn chờ giao.',
    done: 'Đang giao',
  },
  SHIPPED: {
    tab: 'Đang giao',
    next: 'DELIVERED',
    action: 'Đã giao',
    dialogTitle: 'Xác nhận khách đã nhận đơn?',
    dialogNote: 'Đơn chuyển sang Đã giao và không đổi lại được.',
    empty: 'Không có đơn đang giao.',
    done: 'Đã giao',
  },
};
const STATUSES = Object.keys(TABS) as AdminListStatus[];

/** location.state: cursor các trang trước (như trang danh sách sản phẩm, không lên URL) */
interface PageState {
  prevCursors: (string | null)[];
}

function readPrevCursors(state: unknown, page: number): (string | null)[] | undefined {
  const list = (state as Partial<PageState> | null)?.prevCursors;
  if (!Array.isArray(list) || list.length !== page - 1) return undefined;
  return list.every((c) => c === null || typeof c === 'string') ? list : undefined;
}

function search(status: AdminListStatus, cursor?: string, page = 1): string {
  const params = new URLSearchParams();
  if (status !== 'CONFIRMED') params.set('status', status);
  if (cursor) params.set('cursor', cursor);
  if (page > 1) params.set('page', String(page));
  const s = params.toString();
  return s ? `?${s}` : '';
}

/**
 * Quản trị đơn hàng (docs/web/pages/admin-don-hang.md, ordering.md BR-15): xem đơn chờ giao, đang
 * giao và chuyển đơn đi tiếp một bước. Chỉ nhóm `admin` thấy nội dung; API vẫn tự kiểm (403).
 * Không hiện địa chỉ, họ tên, SĐT: API admin không trả các trường này.
 */
export function AdminOrdersPage() {
  // Chưa đăng nhập thì sang /login, đăng nhập xong quay lại đây (như /orders)
  const session = useRequireSignIn();
  const account = useAccount();

  useEffect(() => {
    const previous = document.title;
    document.title = 'Quản trị đơn hàng | Black Magic';
    return () => {
      document.title = previous;
    };
  }, []);

  // Chưa biết phiên (khách sẽ được chuyển sang /login) hoặc chưa đọc xong hồ sơ
  if (session !== 'signedIn' || account.status === 'loading') {
    return <p className={styles.message}>Đang tải…</p>;
  }
  // Nhóm admin đọc từ token; đọc hồ sơ lỗi hoặc không phải admin thì không gọi API admin
  if (account.status !== 'signedIn' || !account.user?.isAdmin) return <Forbidden />;

  return (
    <LiveAnnouncerProvider>
      <AdminOrders />
    </LiveAnnouncerProvider>
  );
}

/** Tiêu đề nhận focus (tabIndex -1) sau khi chuyển đơn: dòng vừa bấm đã rời danh sách */
const Header = forwardRef<HTMLHeadingElement>(function Header(_props, ref) {
  return (
    <>
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Quản trị đơn hàng' }]} />
      <h1 ref={ref} tabIndex={-1} className={styles.title}>
        Quản trị đơn hàng
      </h1>
    </>
  );
});

function Forbidden() {
  return (
    <div className={styles.page}>
      <Header />
      <div className={styles.empty}>
        <p className={styles.emptyText}>Bạn không có quyền xem trang này.</p>
        <Link to="/" className={styles.emptyLink}>
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

function AdminOrders() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const queryClient = useQueryClient();
  const announce = useAnnounce();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const status: AdminListStatus =
    searchParams.get('status') === 'SHIPPED' ? 'SHIPPED' : 'CONFIRMED';
  const cursor = searchParams.get('cursor') ?? undefined;
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const tab = TABS[status];

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.admin.orders(status, cursor),
    queryFn: () => {
      const params = new URLSearchParams({ status, limit: String(PAGE_SIZE) });
      if (cursor) params.set('cursor', cursor);
      return api.get<AdminOrderList>(`/admin/orders?${params}`);
    },
    // Dữ liệu vận hành: luôn đọc mới khi mở lại trang
    staleTime: 0,
  });

  // Đơn đang hỏi lại trước khi chuyển; null thì hộp thoại đóng
  const [target, setTarget] = useState<AdminOrderSummary | null>(null);
  const advance = useMutation({
    mutationFn: (order: AdminOrderSummary) =>
      api.patch<AdminOrderSummary>(`/admin/orders/${order.orderId}`, { status: tab.next }),
    onSuccess: (order) => {
      setTarget(null);
      // Dòng vừa chuyển rời danh sách nên nút đã mở hộp không còn: đưa focus lên tiêu đề
      // (ConfirmDialog chỉ trả focus khi nút đó còn trên trang)
      requestAnimationFrame(() => headingRef.current?.focus());
      announce.polite(`Đã chuyển đơn ${order.orderId.slice(-8)} sang ${tab.done}.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
    },
    onError: (err) => {
      // Đơn vừa đổi ở nơi khác: danh sách đang xem đã cũ
      if (err instanceof ApiError && err.status === 409) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.admin.all });
      }
    },
  });

  if (error instanceof ApiError && error.status === 403) return <Forbidden />;
  if (advance.error instanceof ApiError && advance.error.status === 403) return <Forbidden />;

  const prevCursors = readPrevCursors(location.state, page);
  const next: PagerTarget | undefined = data?.nextCursor
    ? {
        to: { search: search(status, data.nextCursor, page + 1) },
        state: {
          prevCursors: [...(prevCursors ?? Array<null>(page - 1).fill(null)), cursor ?? ''],
        } satisfies PageState,
      }
    : undefined;
  const previous: PagerTarget | undefined =
    page <= 1
      ? undefined
      : prevCursors?.[page - 2]
        ? {
            to: { search: search(status, prevCursors[page - 2] ?? undefined, page - 1) },
            state: { prevCursors: prevCursors.slice(0, -1) } satisfies PageState,
          }
        : { to: { search: search(status) } };

  const orders = data?.items ?? [];

  return (
    <div className={styles.page}>
      <Header ref={headingRef} />
      <p className={styles.lead}>
        Chuyển đơn đã xác nhận sang đang giao khi giao cho vận chuyển, rồi sang đã giao khi khách
        nhận hàng.
      </p>

      {/* Đổi tab là đổi URL nên dùng link điều hướng, không dùng mẫu tab của ARIA */}
      <nav aria-label="Trạng thái đơn" className={styles.tabs}>
        {STATUSES.map((s) => (
          <Link
            key={s}
            to={{ search: search(s) }}
            aria-current={s === status ? 'page' : undefined}
            className={styles.tab}
          >
            {TABS[s].tab}
          </Link>
        ))}
      </nav>

      <div>
        {isPending ? (
          <p className={styles.message}>Đang tải đơn…</p>
        ) : error ? (
          <p role="alert" className={styles.message}>
            Chưa tải được danh sách đơn. Tải lại trang để thử lần nữa.
          </p>
        ) : orders.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyText}>{tab.empty}</p>
          </div>
        ) : (
          <>
            <div className={styles.block}>
              {/* Điện thoại đổi display của dòng, ô sang grid: ghi vai trò tường minh để trình đọc màn
                  hình vẫn đọc như bảng */}
              <table role="table" className={styles.table}>
                <thead role="rowgroup">
                  <tr role="row">
                    <th role="columnheader" scope="col">
                      Mã đơn
                    </th>
                    <th role="columnheader" scope="col">
                      Ngày đặt
                    </th>
                    <th role="columnheader" scope="col" className={styles.num}>
                      Số món
                    </th>
                    <th role="columnheader" scope="col" className={styles.num}>
                      Tổng tiền
                    </th>
                    <th role="columnheader" scope="col">
                      Trạng thái
                    </th>
                    <th role="columnheader" scope="col">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody role="rowgroup">
                  {orders.map((order) => (
                    <tr key={order.orderId} role="row" className={styles.row}>
                      <td role="cell" className={styles.id}>
                        {order.orderId}
                      </td>
                      <td role="cell" className={styles.date}>
                        {formatDateTime(order.createdAt)}
                      </td>
                      <td role="cell" className={`${styles.num} ${styles.count}`}>
                        {order.itemCount}
                        <span className={styles.unit}> món</span>
                      </td>
                      <td role="cell" className={`${styles.num} ${styles.total}`}>
                        <Price amount={order.totalAmount} />
                      </td>
                      <td role="cell" className={styles.status}>
                        <span className={`${styles.badge} ${styles[order.status]}`}>
                          {STATUS_LABEL[order.status]}
                        </span>
                      </td>
                      <td role="cell" className={styles.action}>
                        <button
                          type="button"
                          className={styles.button}
                          aria-label={`${tab.action}: đơn ${order.orderId}`}
                          onClick={() => {
                            advance.reset();
                            setTarget(order);
                          }}
                        >
                          {tab.action}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <CursorPager page={page} previous={previous} next={next} />
          </>
        )}
      </div>

      {target && (
        <ConfirmDialog
          title={tab.dialogTitle}
          confirmLabel={tab.action}
          cancelLabel="Để sau"
          busyLabel="Đang chuyển…"
          busy={advance.isPending}
          error={advance.error ? <AdvanceError error={advance.error} /> : undefined}
          onConfirm={() => advance.mutate(target)}
          onClose={() => setTarget(null)}
        >
          Đơn <span className={styles.id}>{target.orderId}</span> · {target.itemCount} món ·{' '}
          <strong className={styles.dialogTotal}>{formatVnd(target.totalAmount)}</strong>.{' '}
          {tab.dialogNote}
        </ConfirmDialog>
      )}
    </div>
  );
}

/** Câu báo lỗi trong hộp thoại (pages/admin-don-hang.md §3) */
function AdvanceError({ error }: { error: Error }) {
  if (error instanceof ApiError && error.code === 'INVALID_STATUS_TRANSITION') {
    const current = error.currentStatus;
    const label =
      typeof current === 'string' && current in STATUS_LABEL
        ? STATUS_LABEL[current as keyof typeof STATUS_LABEL]
        : undefined;
    return (
      <Alert tone="warning">
        {label ? `Đơn đã ở trạng thái ${label}.` : 'Đơn vừa đổi trạng thái.'} Danh sách đã được tải
        lại.
      </Alert>
    );
  }
  if (error instanceof ApiError && error.status === 404) {
    return (
      <Alert tone="warning">
        Không tìm thấy đơn. Nếu đơn vừa đổi trạng thái, thử lại sau ít giây.
      </Alert>
    );
  }
  return <Alert tone="danger">Chưa chuyển được đơn. Thử lại sau.</Alert>;
}
