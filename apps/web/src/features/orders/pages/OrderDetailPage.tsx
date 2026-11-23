import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Banknote, ChevronLeft, CircleX, Info, Search } from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import { useRequireSignIn } from '../../../shared/auth/useRequireSignIn';
import { Alert } from '../../../shared/components/Alert';
import { Button } from '../../../shared/components/Button';
import { buttonClass } from '../../../shared/components/buttonClass';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { EmptyState } from '../../../shared/components/EmptyState';
import { FreeShipping, OrderSummary } from '../../../shared/components/OrderSummary';
import { formatDateTime, formatVnd } from '../../../shared/lib/format';
import { OrderStatusBadge } from '../components/OrderStatusBadge';
import { OrderStatusSteps } from '../components/OrderStatusSteps';
import { orderTitle } from '../lib/orderTitle';
import { CUSTOMER_CANCELLABLE, STATUS_NOTE, type Order } from '../types';
import styles from './OrderDetailPage.module.css';

/** Thông báo đầu trang (pages/don-hang.md mục 4.5, 5) */
type Notice = 'justCreated' | 'cancelled' | 'cannotCancel';

const NOTICE_TEXT: Record<Notice, ReactNode> = {
  justCreated: (
    <>
      <strong className={styles.noticeTitle}>Đặt hàng thành công!</strong>{' '}
      <span className={styles.noticeLine}>
        Email xác nhận sẽ được gửi trong ít phút. Bạn thanh toán khi nhận hàng.
      </span>
    </>
  ),
  cancelled: 'Đã huỷ đơn.',
  cannotCancel: 'Đơn đã được giao cho đơn vị vận chuyển, không huỷ được nữa.',
};

/** Chi tiết đơn (pages/don-hang.md mục 4): trạng thái, món, địa chỉ, tiền; huỷ đơn có hỏi lại (BR-10) */
export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // Chưa đăng nhập thì sang /login, đăng nhập xong quay lại đúng đơn này (#316)
  const session = useRequireSignIn();

  // Cờ "vừa đặt" từ trang đặt hàng: đọc một lần, rồi xoá khỏi history để tải lại trang không hiện lại
  const [notice, setNotice] = useState<Notice | null>(() =>
    location.state?.justCreated ? 'justCreated' : null,
  );
  useEffect(() => {
    if (location.state?.justCreated) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.orders.detail(orderId!),
    queryFn: () => api.get<Order>(`/orders/${orderId}`),
    enabled: !!orderId && session === 'signedIn',
  });

  // Sau khi huỷ hoặc không huỷ được, nút "Huỷ đơn" biến mất nên đưa focus lên tiêu đề
  const focusHeading = () => requestAnimationFrame(() => headingRef.current?.focus());

  const cancelOrder = useMutation({
    mutationFn: () => api.delete<Order>(`/orders/${orderId}`),
    onSuccess: (order) => {
      // Ghi thẳng kết quả vào cache chi tiết, làm mới danh sách đơn
      queryClient.setQueryData(queryKeys.orders.detail(orderId!), order);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.list() });
      setConfirming(false);
      setNotice('cancelled');
      focusHeading();
    },
    onError: (err) => {
      // Đơn có thể vừa chuyển SHIPPED ở phía admin → tải lại để hiện đúng trạng thái
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId!) });
      if (isCannotCancel(err)) {
        setConfirming(false);
        setNotice('cannotCancel');
        focusHeading();
      }
      // Lỗi khác: giữ hộp thoại mở, báo lỗi trong hộp
    },
  });

  // Thông báo "Đặt hàng thành công!" nhận focus khi trang hiện
  const loaded = data !== undefined;
  useEffect(() => {
    if (loaded && notice === 'justCreated') noticeRef.current?.focus();
  }, [loaded, notice]);

  const back = (
    <Link to="/orders" className={styles.back}>
      <ChevronLeft size={16} aria-hidden="true" />
      Đơn hàng của tôi
    </Link>
  );

  if (session !== 'signedIn' || isPending) {
    return (
      <div className={styles.page}>
        {back}
        <OrderDetailSkeleton />
      </div>
    );
  }

  // 404 cũng là kết quả khi xem đơn của người khác (không lộ là đơn có tồn tại)
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className={styles.page}>
        {back}
        <EmptyState
          icon={Search}
          message="Không tìm thấy đơn hàng này."
          action={
            <Link to="/orders" className={buttonClass()}>
              Xem đơn hàng của tôi
            </Link>
          }
        />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        {back}
        <p role="alert" className={styles.message}>
          Chưa tải được đơn hàng. Tải lại trang để thử lần nữa.
        </p>
      </div>
    );
  }

  const title = orderTitle(data.items[0]?.name ?? '', data.items.length);
  const subtotal = data.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const cancellable = CUSTOMER_CANCELLABLE.includes(data.status);

  return (
    <div className={styles.page}>
      {back}
      <div className={styles.heading}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          {title}
        </h1>
        <OrderStatusBadge status={data.status} />
      </div>
      <p className={styles.sub}>
        Đặt lúc {formatDateTime(data.createdAt)} · Mã đơn{' '}
        <span className={styles.mono}>{data.orderId}</span>
      </p>

      {notice && (
        <div className={styles.notice}>
          <Alert ref={noticeRef} tone={notice === 'cannotCancel' ? 'danger' : 'success'}>
            {NOTICE_TEXT[notice]}
          </Alert>
        </div>
      )}

      <div className={styles.layout}>
        <div className={styles.main}>
          <Block title="Trạng thái">
            {data.status === 'CANCELLED' ? (
              <div className={styles.cancelled}>
                <CircleX className={styles.cancelledIcon} size={24} aria-hidden="true" />
                <div>
                  <p className={styles.cancelledTitle}>Đơn đã huỷ</p>
                  <p className={styles.cancelledTime}>Lúc {formatDateTime(data.updatedAt)}</p>
                </div>
              </div>
            ) : (
              <>
                <OrderStatusSteps
                  status={data.status}
                  createdAt={data.createdAt}
                  updatedAt={data.updatedAt}
                />
                <p className={styles.note}>
                  <Info className={styles.noteIcon} size={20} aria-hidden="true" />
                  <span>{STATUS_NOTE[data.status]}</span>
                </p>
              </>
            )}
          </Block>

          <Block title={`Sản phẩm (${data.items.length})`}>
            <ul className={styles.items}>
              {data.items.map((item) => (
                <li key={item.productId} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <Link to={`/products/${item.productId}`} className={styles.itemName}>
                      {item.name}
                    </Link>
                    <span className={styles.itemUnit}>
                      {formatVnd(item.price)} × {item.quantity}
                    </span>
                  </div>
                  <span className={styles.itemTotal}>{formatVnd(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </Block>

          <Block title="Giao tới">
            <div className={styles.address}>
              <span className={styles.fullName}>{data.shippingAddress.fullName}</span>
              <span>{data.shippingAddress.phone}</span>
              <span>
                {data.shippingAddress.address}, {data.shippingAddress.province}
              </span>
            </div>
          </Block>
        </div>

        <OrderSummary
          title="Thanh toán"
          rows={[
            { label: `Tạm tính (${data.items.length} sản phẩm)`, value: formatVnd(subtotal) },
            { label: 'Phí vận chuyển', value: <FreeShipping /> },
          ]}
          total={data.totalAmount}
        >
          <p className={styles.hint}>
            <Banknote className={styles.hintIcon} size={16} aria-hidden="true" />
            <span>
              Thanh toán khi nhận hàng (COD): trả tiền mặt cho shipper đúng số tiền ở mục Tổng cộng.
            </span>
          </p>
          {cancellable && (
            <>
              <Button
                variant="danger"
                size="lg"
                block
                onClick={() => {
                  cancelOrder.reset();
                  setConfirming(true);
                }}
              >
                Huỷ đơn
              </Button>
              <p className={styles.hint}>Huỷ được khi đơn chưa giao cho đơn vị vận chuyển.</p>
            </>
          )}
        </OrderSummary>
      </div>

      {confirming && (
        <ConfirmDialog
          tone="danger"
          title="Huỷ đơn này?"
          confirmLabel="Huỷ đơn"
          cancelLabel="Giữ đơn"
          busyLabel="Đang huỷ…"
          busy={cancelOrder.isPending}
          error={
            cancelOrder.isError && !isCannotCancel(cancelOrder.error) ? (
              <Alert tone="danger">Không huỷ được đơn, vui lòng thử lại.</Alert>
            ) : undefined
          }
          onConfirm={() => cancelOrder.mutate()}
          onClose={() => setConfirming(false)}
        >
          Đơn “{title}” sẽ bị huỷ và không khôi phục được. Muốn mua lại thì bạn đặt đơn mới.
        </ConfirmDialog>
      )}
    </div>
  );
}

function isCannotCancel(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'CANNOT_CANCEL';
}

/** Khối trắng có tiêu đề h2 (pages/don-hang.md mục 2, 4) */
function Block({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.block} aria-labelledby={id}>
      <h2 id={id} className={styles.blockTitle}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Khung chờ (pages/don-hang.md mục 5): tiêu đề, dòng phụ, 2 khối trái, khối thanh toán phải */
function OrderDetailSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải đơn hàng" role="status">
      <span className={`${styles.bone} ${styles.boneTitle}`} aria-hidden="true" />
      <span className={`${styles.bone} ${styles.boneSub}`} aria-hidden="true" />
      <div className={styles.layout} aria-hidden="true">
        <div className={styles.main}>
          <span className={`${styles.bone} ${styles.boneBlock} ${styles.boneStatus}`} />
          <span className={`${styles.bone} ${styles.boneBlock} ${styles.boneItems}`} />
        </div>
        <span className={`${styles.bone} ${styles.boneBlock} ${styles.boneAside}`} />
      </div>
    </div>
  );
}
