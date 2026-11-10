import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronRight, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import { useRequireSignIn } from '../../../shared/auth/useRequireSignIn';
import { Button } from '../../../shared/components/Button';
import { buttonClass } from '../../../shared/components/buttonClass';
import { EmptyState } from '../../../shared/components/EmptyState';
import { Price } from '../../../shared/components/Price';
import { formatDateTime } from '../../../shared/lib/format';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { orderTitleParts } from '../lib/orderTitle';
import type { OrderListResponse, OrderSummary } from '../types';
import styles from './OrderListPage.module.css';

/** Số đơn mỗi lần tải (pages/don-hang.md mục 1; API cho tối đa 50) */
const ORDER_PAGE_SIZE = 20;

function ordersPath(cursor: string | undefined): string {
  const params = new URLSearchParams({ limit: String(ORDER_PAGE_SIZE) });
  if (cursor) params.set('cursor', cursor);
  return `/orders?${params.toString()}`;
}

/** Đơn hàng của tôi (pages/don-hang.md mục 3): mới nhất trước, "Xem thêm đơn" nối trang sau */
export function OrderListPage() {
  // Chưa đăng nhập thì sang /login như /checkout, không gọi API rồi hiện lỗi (#316)
  const session = useRequireSignIn();
  const orders = useInfiniteQuery({
    // Giữ key cũ: đăng xuất, đặt hàng, huỷ đơn xoá hoặc làm mới đúng key này
    queryKey: queryKeys.orders.list(),
    queryFn: ({ pageParam }) => api.get<OrderListResponse>(ordersPath(pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: session === 'signedIn',
  });

  const heading = <h1 className={styles.title}>Đơn hàng của tôi</h1>;

  if (session !== 'signedIn' || orders.isPending) {
    return (
      <div className={styles.page}>
        {heading}
        <OrderListSkeleton />
      </div>
    );
  }

  // Chỉ báo lỗi cả trang khi chưa có trang nào. Lỗi lúc "Xem thêm đơn" cũng làm isError = true
  // (TanStack Query v5) nhưng vẫn giữ data: giữ danh sách, báo dưới nút
  if (!orders.data) {
    return (
      <div className={styles.page}>
        {heading}
        <p role="alert" className={styles.message}>
          Chưa tải được đơn hàng. Tải lại trang để thử lần nữa.
        </p>
      </div>
    );
  }

  const items = orders.data.pages.flatMap((page) => page.items);

  if (items.length === 0) {
    return (
      <div className={styles.page}>
        {heading}
        <EmptyState
          icon={Package}
          message="Bạn chưa có đơn hàng nào."
          action={
            <Link to="/products" className={buttonClass({ variant: 'primary' })}>
              Mua sắm ngay
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {heading}
      <ul className={styles.list}>
        {items.map((order) => (
          <li key={order.orderId} className={styles.item}>
            <OrderRow order={order} />
          </li>
        ))}
      </ul>
      {orders.hasNextPage && (
        <div className={styles.more}>
          <Button busy={orders.isFetchingNextPage} onClick={() => void orders.fetchNextPage()}>
            {orders.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm đơn'}
          </Button>
          {orders.isFetchNextPageError && (
            <p role="alert" className={styles.message}>
              Chưa tải thêm được. Bấm lại để thử lần nữa.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Một dòng đơn: cả dòng là một link, chữ trong link đọc đủ tên đơn, trạng thái, ngày, mã, tổng tiền */
function OrderRow({ order }: { order: OrderSummary }) {
  const { name, others } = orderTitleParts(order.firstItemName, order.itemCount);
  return (
    // Các phần là span trong lưới, flex: chèn {' '} để tên link đọc tách từng phần (khoảng trắng
    // giữa các phần tử flex, grid không hiện ra nên không đổi bố cục)
    <Link to={`/orders/${order.orderId}`} className={styles.row}>
      <span className={styles.titleLine}>
        <span className={styles.titleText}>
          <span className={styles.name}>{name}</span>{' '}
          {others && <span className={styles.others}>{others}</span>}
        </span>{' '}
        <span className={styles.badge}>
          <OrderStatusBadge status={order.status} />
        </span>
      </span>{' '}
      <span className={styles.meta}>
        Đặt lúc {formatDateTime(order.createdAt)} · {order.itemCount} sản phẩm
      </span>{' '}
      <span className={styles.code}>
        Mã đơn <span className={styles.mono}>{order.orderId}</span>
      </span>{' '}
      <span className={styles.total}>
        <Price amount={order.totalAmount} />
      </span>
      <ChevronRight className={styles.chevron} size={20} aria-hidden="true" />
    </Link>
  );
}

/** Khung chờ 4 dòng (pages/don-hang.md mục 5) */
function OrderListSkeleton() {
  return (
    <ul className={styles.list} aria-busy="true" aria-label="Đang tải đơn hàng">
      {[0, 1, 2, 3].map((i) => (
        <li key={i} className={styles.item}>
          <div className={styles.skeletonRow} aria-hidden="true">
            <span className={`${styles.bar} ${styles.barTitle}`} />
            <span className={`${styles.bar} ${styles.barMeta}`} />
            <span className={`${styles.bar} ${styles.barTotal}`} />
          </div>
        </li>
      ))}
    </ul>
  );
}
