import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Banknote, ShoppingCart } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import { useSession } from '../../../shared/auth/useSession';
import { Alert } from '../../../shared/components/Alert';
import { Field } from '../../../shared/components/Field';
import { FreeShipping, OrderSummary } from '../../../shared/components/OrderSummary';
import { formatVnd } from '../../../shared/lib/format';
import { clearCheckoutItems, loadCheckoutItems, saveCheckoutItems } from '../lib/checkoutStorage';
import type {
  CartItem,
  CreateOrderRequest,
  Order,
  ShippingAddress,
} from '../../../shared/api/types';
import styles from './CheckoutPage.module.css';

/** Món đã tick ở giỏ, truyền sang checkout */
type SelectedItem = Pick<CartItem, 'productId' | 'name' | 'price' | 'quantity'>;

/** Chuẩn hoá trước khi gửi để khớp ràng buộc trong OpenAPI (ShippingAddress) */
const normalizePhone = (phone: string) => phone.replace(/\s/g, '');
const toPayload = (form: ShippingAddress): ShippingAddress => ({
  fullName: form.fullName.trim(),
  phone: normalizePhone(form.phone),
  address: form.address.trim(),
  province: form.province.trim(),
});

/**
 * Server CHẮC CHẮN chưa tạo đơn → lần gửi sau dùng key mới là an toàn.
 * Ngoại lệ: 409 ORDER_IN_PROGRESS nghĩa là lần gửi trước VẪN đang chạy và có thể tạo đơn,
 * nên phải giữ nguyên key để lần bấm sau nhận lại đúng đơn đó.
 */
function isDefiniteFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false; // mạng lỗi: không biết server đã làm gì
  if (error.status === 409) return error.code !== 'ORDER_IN_PROGRESS';
  return error.status === 400 || error.status === 422;
}

export function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Nhận danh sách items đã tick từ CartPage qua navigation state.
  // Để trong state vì giá có thể được cập nhật khi server báo PRICE_CHANGED
  // Lưu thêm vào sessionStorage để bấm F5 không mất (navigation state mất khi tải lại trang)
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>(() =>
    location.state?.selectedItems
      ? saveCheckoutItems(location.state.selectedItems)
      : loadCheckoutItems(),
  );
  const updateSelectedItems = (update: (items: SelectedItem[]) => SelectedItem[]) =>
    setSelectedItems((items) => saveCheckoutItems(update(items)));
  // Món vừa đổi giá sau PRICE_CHANGED, để gắn nhãn "Giá mới" trong tóm tắt
  const [repriced, setRepriced] = useState<ReadonlySet<string>>(() => new Set());

  const [form, setForm] = useState<ShippingAddress>(EMPTY_FORM);
  const [formError, setFormError] = useState<Partial<ShippingAddress>>({});
  // Sau lần bấm đầu tiên thì kiểm lại từng ô khi rời ô
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const formId = useId();

  // ── Idempotency-Key (BR-04) ──────────────────────────────────────────────────
  // Sinh MỘT lần cho mỗi lượt checkout và giữ nguyên qua các lần bấm lại.
  // Mạng lỗi / 5xx: không biết server đã tạo đơn chưa → gửi lại CÙNG key, server trả đơn cũ.
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());

  // ── Mutation tạo đơn ─────────────────────────────────────────────────────────
  // Mọi hook phải gọi trước bất kỳ lệnh return sớm nào (Rules of Hooks)
  const createOrder = useMutation({
    mutationFn: () =>
      api.post<Order>(
        '/orders',
        {
          // expectedPrice = giá khách đang nhìn thấy; server so với giá hiện tại (ordering.md BR-07)
          items: selectedItems.map(({ productId, quantity, price }) => ({
            productId,
            quantity,
            expectedPrice: price,
          })),
          shippingAddress: toPayload(form),
        } satisfies CreateOrderRequest, // body sai so với OpenAPI → lỗi lúc biên dịch
        { headers: { 'Idempotency-Key': idempotencyKey } },
      ),
    onSuccess: (order) => {
      clearCheckoutItems();
      // Server đã xoá các món đã đặt khỏi giỏ → làm mới cache giỏ và lịch sử đơn
      queryClient.invalidateQueries({ queryKey: queryKeys.cart.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      // replace: bấm Back không quay lại form checkout đã gửi
      navigate(`/orders/${order.orderId}`, { replace: true, state: { justCreated: true } });
    },
    onError: (error) => {
      if (isDefiniteFailure(error)) setIdempotencyKey(crypto.randomUUID());

      // Giá đổi: hiện giá mới ngay trên trang để khách xem lại rồi bấm xác nhận lần nữa
      if (error instanceof ApiError && error.code === 'PRICE_CHANGED') {
        const newPrice = new Map(error.changedItems.map((c) => [c.productId, c.currentPrice]));
        updateSelectedItems((items) =>
          items.map((i) =>
            newPrice.has(i.productId) ? { ...i, price: newPrice.get(i.productId)! } : i,
          ),
        );
        setRepriced(new Set(newPrice.keys()));
      }
    },
  });

  // Đặt hàng bắt buộc đăng nhập (ordering BR-01): chưa đăng nhập thì sang trang đăng nhập,
  // xong quay lại đây (các món đã chọn vẫn nằm trong sessionStorage)
  const session = useSession();
  useEffect(() => {
    if (session === 'guest') {
      navigate('/login', { replace: true, state: { from: '/checkout', reason: 'checkout' } });
    }
  }, [session, navigate]);

  // Thông báo lỗi vừa hiện → chuyển focus tới để người dùng bàn phím, trình đọc màn hình biết
  useEffect(() => {
    if (createOrder.isError) alertRef.current?.focus();
  }, [createOrder.isError, createOrder.failureCount]);

  // ── Vào trang này không qua giỏ (hoặc hết phiên) → hướng về giỏ ─────────────
  if (selectedItems.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>Đặt hàng</h1>
        <section className={styles.empty} aria-label="Chưa có sản phẩm">
          <ShoppingCart size={48} strokeWidth={1.75} aria-hidden="true" />
          <p className={styles.emptyText}>Chưa có sản phẩm nào để đặt.</p>
          <Link to="/cart" className={styles.secondaryButton}>
            Quay lại giỏ hàng
          </Link>
        </section>
      </div>
    );
  }

  const total = selectedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const pending = createOrder.isPending;

  const validate = (values: ShippingAddress): Partial<ShippingAddress> => {
    const errors: Partial<ShippingAddress> = {};
    if (!values.fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên';
    if (!values.phone.trim()) errors.phone = 'Vui lòng nhập số điện thoại';
    else if (!/^(0|\+84)\d{9}$/.test(normalizePhone(values.phone)))
      errors.phone = 'Số điện thoại không hợp lệ';
    if (!values.address.trim()) errors.address = 'Vui lòng nhập địa chỉ';
    if (!values.province.trim()) errors.province = 'Vui lòng nhập tỉnh/thành phố';
    return errors;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setSubmitted(true);
    const errors = validate(form);
    setFormError(errors);
    const firstError = FIELDS.find((f) => errors[f.key]);
    if (firstError) {
      formRef.current?.querySelector<HTMLInputElement>(`[name="${firstError.key}"]`)?.focus();
      return;
    }
    createOrder.mutate();
  };

  const fieldProps = (key: keyof ShippingAddress) => ({
    name: key,
    value: form[key],
    error: formError[key],
    readOnly: pending,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
    onBlur: () => {
      if (submitted) setFormError(validate(form));
    },
  });

  const nameOf = (productId: string) =>
    selectedItems.find((i) => i.productId === productId)?.name ?? productId;

  return (
    <div className={styles.page}>
      <Link to="/cart" className={styles.back}>
        <ArrowLeft size={16} aria-hidden="true" />
        Quay lại giỏ hàng
      </Link>
      <h1 className={styles.title}>Đặt hàng</h1>

      <div className={styles.layout}>
        <div className={styles.steps}>
          <CheckoutStep number={1} title="Thông tin giao hàng">
            <form
              id={formId}
              ref={formRef}
              className={styles.form}
              onSubmit={handleSubmit}
              noValidate
            >
              <p className={styles.requiredNote}>* bắt buộc</p>
              {FIELDS.map((f) => (
                <Field
                  key={f.key}
                  className={f.wide ? styles.wide : undefined}
                  label={f.label}
                  type={f.type}
                  inputMode={f.type === 'tel' ? 'tel' : undefined}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  maxLength={f.maxLength}
                  hint={f.hint}
                  size="lg"
                  required
                  {...fieldProps(f.key)}
                />
              ))}
            </form>
          </CheckoutStep>

          <CheckoutStep number={2} title="Thanh toán">
            <div className={styles.payment}>
              <Banknote size={24} className={styles.paymentIcon} aria-hidden="true" />
              <div>
                <p className={styles.paymentTitle}>Thanh toán khi nhận hàng (COD)</p>
                <p className={styles.paymentNote}>
                  Trả tiền mặt cho shipper đúng số tiền ở mục Tổng cộng, không phát sinh thêm.
                </p>
              </div>
            </div>
          </CheckoutStep>
        </div>

        <OrderSummary
          className={styles.summary}
          title={`Đơn hàng (${selectedItems.length} sản phẩm)`}
          content={
            <ul className={styles.items}>
              {selectedItems.map((item) => (
                <li key={item.productId} className={styles.item}>
                  <div className={styles.itemInfo}>
                    <span className={styles.itemName}>{item.name}</span>
                    <span className={styles.itemQty}>× {item.quantity}</span>
                    {repriced.has(item.productId) && (
                      <span className={styles.newPrice}>Giá mới</span>
                    )}
                  </div>
                  <span className={styles.itemAmount}>{formatVnd(item.price * item.quantity)}</span>
                </li>
              ))}
            </ul>
          }
          rows={[
            { label: 'Tạm tính', value: formatVnd(total) },
            { label: 'Phí vận chuyển', value: <FreeShipping /> },
          ]}
          total={total}
        >
          {createOrder.isError && (
            <Alert ref={alertRef} tone={alertTone(createOrder.error)}>
              <OrderErrorMessage error={createOrder.error} nameOf={nameOf} />
            </Alert>
          )}
          {/* Nút nằm cạnh con số tổng; thuộc tính form vẫn gửi form ở cột trái */}
          <button
            type="submit"
            form={formId}
            className={styles.primaryButton}
            disabled={pending}
            aria-busy={pending || undefined}
          >
            {pending ? 'Đang đặt hàng…' : 'Xác nhận đặt hàng'}
          </button>
          <p className={styles.hint}>
            <Banknote size={16} aria-hidden="true" /> Thanh toán khi nhận hàng (COD)
          </p>
        </OrderSummary>
      </div>
    </div>
  );
}

const EMPTY_FORM: ShippingAddress = { fullName: '', phone: '', address: '', province: '' };

/** Các ô của form giao hàng (dat-hang.md §3.2), theo thứ tự hiển thị */
const FIELDS: readonly {
  key: keyof ShippingAddress;
  label: string;
  type: 'text' | 'tel';
  autoComplete: string;
  maxLength: number;
  placeholder?: string;
  hint?: string;
  wide?: boolean;
}[] = [
  { key: 'fullName', label: 'Họ và tên', type: 'text', autoComplete: 'name', maxLength: 100 },
  {
    key: 'phone',
    label: 'Số điện thoại',
    type: 'tel',
    autoComplete: 'tel',
    maxLength: 16,
    placeholder: '0912 345 678',
    hint: 'Shipper gọi số này khi giao hàng.',
  },
  {
    key: 'address',
    label: 'Địa chỉ',
    type: 'text',
    autoComplete: 'street-address',
    maxLength: 200,
    placeholder: 'Số nhà, tên đường, phường/xã',
    wide: true,
  },
  {
    key: 'province',
    label: 'Tỉnh / Thành phố',
    type: 'text',
    autoComplete: 'address-level1',
    maxLength: 100,
    placeholder: 'TP. Hồ Chí Minh',
  },
];

/** Khối có số thứ tự ở cột trái (dat-hang.md §3.1) */
function CheckoutStep({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section className={styles.step} aria-labelledby={titleId}>
      <div className={styles.stepHead}>
        <span className={styles.stepNumber} aria-hidden="true">
          {number}
        </span>
        <h2 id={titleId} className={styles.stepTitle}>
          {title}
        </h2>
      </div>
      <div className={styles.stepBody}>{children}</div>
    </section>
  );
}

/** Giá đổi, đơn đang xử lý: cảnh báo; còn lại là lỗi */
function alertTone(error: unknown): 'warning' | 'danger' {
  return error instanceof ApiError &&
    (error.code === 'PRICE_CHANGED' || error.code === 'ORDER_IN_PROGRESS')
    ? 'warning'
    : 'danger';
}

/** Thông báo lỗi đặt hàng theo mã nghiệp vụ (ordering.md "Trường hợp đặc biệt") */
function OrderErrorMessage({
  error,
  nameOf,
}: {
  error: unknown;
  nameOf: (productId: string) => string;
}) {
  if (!(error instanceof ApiError)) {
    return <>Không kết nối được máy chủ. Bấm đặt hàng lại sẽ không tạo đơn trùng.</>;
  }

  switch (error.code) {
    case 'OUT_OF_STOCK':
      return (
        <>
          Một số sản phẩm không đủ hàng. <Link to="/cart">Quay lại giỏ hàng để điều chỉnh</Link>:
          <ul>
            {error.invalidItems.map((i) => (
              <li key={i.productId}>
                {nameOf(i.productId)}:{' '}
                {i.available > 0 ? `chỉ còn ${i.available}` : 'hết hàng hoặc ngừng bán'}
              </li>
            ))}
          </ul>
        </>
      );
    case 'PRICE_CHANGED':
      return (
        <>
          Giá đã thay đổi. Tóm tắt đơn đã cập nhật giá mới, vui lòng kiểm tra rồi bấm xác nhận lại:
          <ul>
            {error.changedItems.map((c) => (
              <li key={c.productId}>
                {nameOf(c.productId)}: {formatVnd(c.expectedPrice)} → {formatVnd(c.currentPrice)}
              </li>
            ))}
          </ul>
        </>
      );
    case 'ORDER_IN_PROGRESS':
      return (
        <>
          Đơn của bạn đang được xử lý. Vui lòng đợi vài giây rồi bấm lại; bạn sẽ không bị đặt trùng.
        </>
      );
    default:
      return <>{error.detail ?? error.title}</>;
  }
}
