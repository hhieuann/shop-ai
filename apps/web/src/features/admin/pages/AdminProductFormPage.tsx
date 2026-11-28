import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Link,
  useBlocker,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { CircleAlert, Copy, Sparkles } from 'lucide-react';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { AdminProduct, ProductCategory } from '../../../shared/api/types';
import { Alert } from '../../../shared/components/Alert';
import { Button } from '../../../shared/components/Button';
import { buttonClass } from '../../../shared/components/buttonClass';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { Field } from '../../../shared/components/Field';
import { Switch } from '../../../shared/components/Switch';
import { ToastProvider } from '../../../shared/components/Toast';
import { useToast } from '../../../shared/components/toastContext';
import { useToastOffset } from '../../../shared/hooks/useToastOffset';
import { ProductCard } from '../../catalog/components/ProductCard';
import { CATEGORIES, categoryLabel } from '../../catalog/lib/productFilters';
import { specLabel } from '../../catalog/lib/specLabels';
import { AdminForbidden } from '../components/AdminForbidden';
import { CopyFromPanel } from '../components/CopyFromPanel';
import { ImagePreview } from '../components/ImagePreview';
import {
  copyFrom,
  emptyForm,
  formatAmount,
  fromProduct,
  fromTemplate,
  LIMITS,
  parseAmount,
  sameForm,
  toCreateBody,
  toPatchBody,
  validateProduct,
  type ProductFormErrors,
  type ProductFormValues,
} from '../lib/productForm';
import { DEFAULT_ADMIN_CATEGORY } from '../lib/adminProductFilters';
import { PRODUCT_TEMPLATES } from '../lib/productTemplates';
import styles from './AdminProductFormPage.module.css';

/** location.state khi vừa thêm xong: trang sửa hiện câu này bằng Toast */
interface CreatedState {
  created?: string;
}

/**
 * Thêm `/admin/products/new` và sửa `/admin/products/:productId/edit` (pages/admin-san-pham.md
 * mục 3, catalog.md BR-11 … BR-14). Nằm trong khung quản trị (`AdminLayout`); API vẫn tự kiểm (403).
 */
export function AdminProductFormPage() {
  const { productId } = useParams();
  useEffect(() => {
    const previous = document.title;
    document.title = `${productId ? 'Sửa' : 'Thêm'} sản phẩm | Black Magic`;
    return () => {
      document.title = previous;
    };
  }, [productId]);

  return (
    <ToastProvider>
      {productId ? <EditLoader productId={productId} /> : <NewLoader />}
    </ToastProvider>
  );
}

/** Đọc một sản phẩm cho trang sửa hoặc cho `?from=` */
function useAdminProduct(productId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.admin.product(productId ?? ''),
    queryFn: () => api.get<AdminProduct>(`/admin/products/${productId}`),
    enabled: Boolean(productId),
    staleTime: 0,
  });
}

function LoadState({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.status === 403) return <AdminForbidden />;
  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className={styles.state}>
        <p>Không tìm thấy sản phẩm.</p>
        <Link to="/admin/products" className={styles.link}>
          Về danh sách sản phẩm
        </Link>
      </div>
    );
  }
  if (error) {
    return (
      <p role="alert" className={styles.state}>
        Chưa tải được sản phẩm. Tải lại trang để thử lần nữa.
      </p>
    );
  }
  return <p className={styles.state}>Đang tải sản phẩm…</p>;
}

function NewLoader() {
  const [searchParams] = useSearchParams();
  const fromId = searchParams.get('from') ?? undefined;
  const from = useAdminProduct(fromId);
  const rawCategory = searchParams.get('category');
  const category = CATEGORIES.some((c) => c.value === rawCategory)
    ? (rawCategory as ProductCategory)
    : DEFAULT_ADMIN_CATEGORY;

  if (fromId) {
    if (!from.data) return <LoadState error={from.error} />;
    return (
      <ProductForm
        key={`from-${fromId}`}
        initialCategory={from.data.category}
        initialValues={copyFrom(from.data)}
        initialSource={{ kind: 'copy', name: from.data.name }}
      />
    );
  }
  return (
    <ProductForm
      key={`new-${category}`}
      initialCategory={category}
      initialValues={fromTemplate(category)}
      initialSource={{ kind: 'template' }}
    />
  );
}

function EditLoader({ productId }: { productId: string }) {
  const { data, error, isFetchedAfterMount } = useAdminProduct(productId);
  // Form chép giá trị một lần: chờ bản mới đọc sau khi mở trang, không vẽ từ bản cũ trong cache
  // (gửi updatedAt cũ sẽ bị 409, review #559). Lần tải lại ngầm sau đó không vẽ lại form
  if (!data || !isFetchedAfterMount) return <LoadState error={error} />;
  return <ProductForm key={productId} initialCategory={data.category} product={data} />;
}

/** Nguồn dữ liệu đã điền sẵn của trang thêm: mẫu của loại hoặc một sản phẩm có sẵn */
type Source = { kind: 'template' } | { kind: 'copy'; name: string } | null;

function ProductForm({
  initialCategory,
  initialValues,
  initialSource = null,
  product,
}: {
  initialCategory: ProductCategory;
  initialValues?: ProductFormValues;
  initialSource?: Source;
  /** Có: trang sửa */
  product?: AdminProduct;
}) {
  const editing = product !== undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  // Thanh "Lưu sản phẩm" dính đáy: thông báo nổi đứng trên thanh, không che nút Lưu
  const barRef = useRef<HTMLDivElement>(null);
  useToastOffset(barRef);

  const [category, setCategory] = useState(initialCategory);
  const [original, setOriginal] = useState(product);
  const startValues = product ? fromProduct(product) : (initialValues ?? emptyForm(category));
  const [values, setValues] = useState<ProductFormValues>(startValues);
  // Bản dùng để biết có thay đổi chưa lưu: lúc mở trang, sau khi điền mẫu, sau khi lưu
  const [baseline, setBaseline] = useState<ProductFormValues>(startValues);
  const [source, setSource] = useState<Source>(initialSource);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [pendingCategory, setPendingCategory] = useState<ProductCategory | null>(null);
  const [showCopy, setShowCopy] = useState(false);
  const [conflict, setConflict] = useState<AdminProduct | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  // Vừa lưu xong và đang chuyển trang: không hỏi "Rời trang?"
  const leaving = useRef(false);

  const deleted = original?.deletedAt !== undefined;
  const dirty = !sameForm(values, baseline);

  // Vừa thêm xong (trang thêm chuyển sang đây): báo một lần rồi bỏ khỏi lịch sử
  useEffect(() => {
    const created = (location.state as CreatedState | null)?.created;
    if (!created) return;
    toast.show(`Đã thêm "${created}".`);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate, toast]);

  // Rời trang khi có thay đổi chưa lưu: hỏi lại (trong app và khi đóng tab)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  );
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));
  const setSpec = (key: string, value: string) =>
    setValues((v) => ({ ...v, specs: { ...v.specs, [key]: value } }));

  /** Chọn loại (trang thêm): điền mẫu của loại; đã sửa ô nào thì hỏi lại trước */
  const chooseCategory = (next: ProductCategory) => {
    if (next === category) return;
    if (dirty) return setPendingCategory(next);
    applyTemplate(next);
  };
  const applyTemplate = (next: ProductCategory) => {
    const filled = fromTemplate(next);
    setCategory(next);
    setValues(filled);
    setBaseline(filled);
    setSource({ kind: 'template' });
    setErrors({});
    setPendingCategory(null);
  };
  const clearTemplate = () => {
    setValues(emptyForm(category));
    setSource(null);
    setErrors({});
  };
  const applyCopy = (from: AdminProduct) => {
    const filled = copyFrom(from);
    setCategory(from.category);
    setValues(filled);
    setSource({ kind: 'copy', name: from.name });
    setShowCopy(false);
    setErrors({});
  };

  /** Lỗi 400 của API: gắn vào ô theo errors[].field (cả specs.<khoá>) */
  const showApiErrors = (err: ApiError) => {
    const byField: ProductFormErrors = {};
    for (const e of err.errors) byField[e.field] = e.message;
    setErrors(byField);
    setFormError(
      err.errors.length > 0 ? 'Kiểm lại các ô đánh dấu đỏ.' : 'Dữ liệu chưa hợp lệ. Kiểm lại form.',
    );
    focusFirstError();
  };
  const focusFirstError = () =>
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(),
    );

  const save = useMutation({
    mutationFn: async (): Promise<AdminProduct | null> => {
      if (!editing) {
        return api.post<AdminProduct>('/admin/products', toCreateBody(category, values));
      }
      const body = original ? toPatchBody(original, values) : null;
      if (!body || !original) return null;
      return api.patch<AdminProduct>(`/admin/products/${original.productId}`, body);
    },
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.productLists() });
      if (!editing && saved) {
        leaving.current = true;
        navigate(`/admin/products/${saved.productId}/edit`, {
          state: { created: saved.name } satisfies CreatedState,
        });
        return;
      }
      if (saved) {
        queryClient.setQueryData(queryKeys.admin.product(saved.productId), saved);
        const next = fromProduct(saved);
        setOriginal(saved);
        setValues(next);
        setBaseline(next);
      }
      toast.show(saved ? 'Đã lưu thay đổi.' : 'Không có thay đổi nào để lưu.');
    },
    onError: (err) => {
      if (!(err instanceof ApiError)) return setFormError('Chưa lưu được. Thử lại sau.');
      if (err.status === 403) return setForbidden(true);
      if (err.status === 404) return setNotFound(true);
      if (err.status === 400) return showApiErrors(err);
      if (err.code === 'STOCK_CHANGED') return onStockChanged(err.currentStock);
      if (err.code === 'PRODUCT_CHANGED') return void onProductChanged();
      setFormError('Chưa lưu được. Thử lại sau.');
    },
  });

  /** 409 STOCK_CHANGED: báo tồn kho mới ở ô tồn kho; lần lưu sau gửi expectedStock theo số mới */
  const onStockChanged = (current?: number) => {
    if (current === undefined || !original) {
      setFormError('Tồn kho vừa đổi. Tải lại trang rồi sửa lại.');
      return;
    }
    setOriginal({ ...original, stock: current });
    setErrors({
      stock: `Tồn kho vừa đổi thành ${current} (có thể do khách vừa đặt hàng). Kiểm lại số tồn kho rồi lưu lại.`,
    });
    setFormError(null);
    focusFirstError();
  };

  /** 409 PRODUCT_CHANGED: đọc bản mới, hiện dải cảnh báo kèm nút nạp bản mới */
  const onProductChanged = async () => {
    if (!original) return;
    try {
      const latest = await api.get<AdminProduct>(`/admin/products/${original.productId}`);
      setConflict(latest);
    } catch {
      setFormError('Sản phẩm vừa được sửa ở nơi khác. Tải lại trang để xem bản mới.');
    }
  };
  const loadLatest = () => {
    if (!conflict) return;
    const next = fromProduct(conflict);
    setOriginal(conflict);
    setValues(next);
    setBaseline(next);
    setErrors({});
    setFormError(null);
    setConflict(null);
  };

  const restore = useMutation({
    mutationFn: () => api.post<AdminProduct>(`/admin/products/${original?.productId}/restore`, {}),
    onSuccess: (restored) => {
      const next = fromProduct(restored);
      setOriginal(restored);
      setValues(next);
      setBaseline(next);
      void queryClient.invalidateQueries({ queryKey: queryKeys.admin.productLists() });
      toast.show(`Đã khôi phục "${restored.name}". Sản phẩm đang ở trạng thái đã ẩn.`);
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 403) return setForbidden(true);
      setFormError('Chưa khôi phục được. Thử lại sau.');
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (save.isPending || deleted) return;
    const found = validateProduct(values);
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError('Kiểm lại các ô đánh dấu đỏ.');
      focusFirstError();
      return;
    }
    setFormError(null);
    save.mutate();
  };

  if (forbidden) return <AdminForbidden />;
  if (notFound) return <LoadState error={new ApiError(404, {}, 'Not Found')} />;

  const template = PRODUCT_TEMPLATES[category];
  const preview = {
    productId: original?.productId ?? '',
    name: values.name.trim() || 'Tên sản phẩm',
    category,
    brand: values.brand,
    price: Number.isNaN(parseAmount(values.price)) ? 0 : parseAmount(values.price),
    stock: Number.isNaN(parseAmount(values.stock)) ? 0 : parseAmount(values.stock),
    status: values.active ? ('ACTIVE' as const) : ('INACTIVE' as const),
    ...(/^https:\/\/\S+$/.test(values.imageUrl.trim()) && { imageUrl: values.imageUrl.trim() }),
  };
  const busy = save.isPending;

  return (
    <form ref={formRef} className={styles.page} onSubmit={submit} noValidate>
      <div className={styles.head}>
        <div>
          <h1 className={styles.title}>{editing ? original?.name : 'Thêm sản phẩm'}</h1>
          <p className={styles.lead}>
            {editing
              ? `${categoryLabel(category)} · Loại hàng không đổi được sau khi thêm.`
              : 'Chọn loại hàng để điền mẫu, rồi sửa lại cho đúng món đang bán.'}
          </p>
        </div>
        {!editing && (
          <Button onClick={() => setShowCopy((v) => !v)} aria-expanded={showCopy}>
            <Copy size={18} aria-hidden="true" />
            Sao chép từ sản phẩm có sẵn
          </Button>
        )}
      </div>

      {showCopy && (
        <CopyFromPanel category={category} onCopy={applyCopy} onClose={() => setShowCopy(false)} />
      )}
      {conflict && (
        <Alert
          tone="warning"
          action={
            <Button size="sm" onClick={loadLatest}>
              Nạp bản mới
            </Button>
          }
        >
          Sản phẩm vừa được sửa ở nơi khác. Nạp bản mới sẽ bỏ phần bạn đang sửa.
        </Alert>
      )}
      {deleted && (
        <Alert
          tone="warning"
          action={
            <Button size="sm" busy={restore.isPending} onClick={() => restore.mutate()}>
              {restore.isPending ? 'Đang khôi phục…' : 'Khôi phục'}
            </Button>
          }
        >
          Sản phẩm này đã bị xoá. Khôi phục để sửa (sản phẩm về trạng thái đã ẩn).
        </Alert>
      )}

      <fieldset className={styles.fieldset} disabled={deleted}>
        <div className={styles.grid}>
          <div className={styles.main}>
            {!editing && (
              <section className={styles.block} aria-labelledby="category-title">
                <h2 id="category-title" className={styles.blockTitle}>
                  Loại hàng
                </h2>
                <div role="radiogroup" aria-labelledby="category-title" className={styles.chips}>
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      role="radio"
                      aria-checked={c.value === category}
                      className={styles.chip}
                      onClick={() => chooseCategory(c.value)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {source && (
                  <div className={styles.strip}>
                    <span>
                      <Sparkles size={16} aria-hidden="true" />{' '}
                      {source.kind === 'template'
                        ? `Đã điền mẫu ${categoryLabel(category)}. Sửa lại tên, giá, tồn kho và thông số cho đúng.`
                        : `Đã sao chép từ "${source.name}". Nhập tên, giá, tồn kho và ảnh.`}
                    </span>
                    <Button size="sm" onClick={clearTemplate}>
                      Xoá mẫu
                    </Button>
                  </div>
                )}
              </section>
            )}

            <section className={styles.block} aria-labelledby="general-title">
              <h2 id="general-title" className={styles.blockTitle}>
                Thông tin chung
              </h2>
              <div className={styles.fields}>
                <Field
                  label="Tên sản phẩm"
                  required
                  value={values.name}
                  placeholder={template.namePlaceholder}
                  maxLength={LIMITS.name}
                  error={errors.name}
                  onChange={(e) => set('name', e.target.value)}
                />
                <Field
                  label="Hãng"
                  required
                  value={values.brand}
                  maxLength={LIMITS.brand}
                  error={errors.brand}
                  onChange={(e) => set('brand', e.target.value)}
                />
                <TextArea
                  label="Mô tả"
                  value={values.description}
                  error={errors.description}
                  onChange={(v) => set('description', v)}
                />
              </div>
            </section>

            <section className={styles.block} aria-labelledby="price-title">
              <h2 id="price-title" className={styles.blockTitle}>
                Giá và tồn kho
              </h2>
              <div className={styles.two}>
                <Field
                  label="Giá bán (₫)"
                  required
                  inputMode="numeric"
                  placeholder="Nhập giá"
                  value={values.price}
                  error={errors.price}
                  onChange={(e) => set('price', e.target.value)}
                  onBlur={() => set('price', formatAmount(values.price))}
                />
                <Field
                  label="Tồn kho"
                  required
                  inputMode="numeric"
                  placeholder="Nhập số lượng"
                  value={values.stock}
                  error={errors.stock}
                  onChange={(e) => set('stock', e.target.value)}
                />
              </div>
            </section>

            <section className={styles.block} aria-labelledby="specs-title">
              <h2 id="specs-title" className={styles.blockTitle}>
                Thông số
              </h2>
              <p className={styles.blockHint}>Ô để trống thì không lưu.</p>
              <div className={styles.two}>
                {Object.keys(values.specs).map((key) => (
                  <Field
                    key={key}
                    label={specLabel(key)}
                    value={values.specs[key] ?? ''}
                    maxLength={LIMITS.specValue}
                    error={errors[`specs.${key}`]}
                    onChange={(e) => setSpec(key, e.target.value)}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className={styles.side}>
            <section className={styles.block} aria-label="Trạng thái bán">
              <Switch
                label="Đang bán"
                description="Tắt để lưu ở trạng thái đã ẩn"
                checked={values.active}
                onChange={(active) => set('active', active)}
              />
            </section>
            <section className={styles.block} aria-labelledby="image-title">
              <h2 id="image-title" className={styles.blockTitle}>
                Ảnh
              </h2>
              <div className={styles.fields}>
                <Field
                  label="Đường dẫn ảnh (https)"
                  type="url"
                  placeholder="https://…"
                  value={values.imageUrl}
                  maxLength={LIMITS.imageUrl}
                  error={errors.imageUrl}
                  onChange={(e) => set('imageUrl', e.target.value)}
                />
                <ImagePreview url={values.imageUrl} />
              </div>
            </section>
            <section className={styles.block} aria-labelledby="preview-title">
              <h2 id="preview-title" className={styles.blockTitle}>
                Xem trước
              </h2>
              {/* Thẻ như ở cửa hàng; chỉ để xem nên không bấm được */}
              <div
                className={styles.preview}
                aria-hidden="true"
                ref={(el) => el?.setAttribute('inert', '')}
              >
                <ProductCard product={preview} />
              </div>
            </section>
          </div>
        </div>
      </fieldset>

      <div ref={barRef} className={styles.bar}>
        {formError && (
          <p role="alert" className={styles.formError}>
            <CircleAlert size={16} aria-hidden="true" />
            {formError}
          </p>
        )}
        <Link to="/admin/products" className={buttonClass({})}>
          Huỷ
        </Link>
        <Button type="submit" variant="primary" busy={busy} disabled={deleted}>
          {busy ? 'Đang lưu…' : 'Lưu sản phẩm'}
        </Button>
      </div>

      {pendingCategory && (
        <ConfirmDialog
          title="Đổi loại hàng?"
          confirmLabel="Đổi loại"
          cancelLabel="Giữ loại cũ"
          busyLabel="Đang đổi…"
          onConfirm={() => applyTemplate(pendingCategory)}
          onClose={() => setPendingCategory(null)}
        >
          Các ô đã nhập sẽ được thay bằng mẫu của {categoryLabel(pendingCategory)}.
        </ConfirmDialog>
      )}
      {blocker.state === 'blocked' && (
        <ConfirmDialog
          title="Rời trang?"
          confirmLabel="Rời trang"
          cancelLabel="Ở lại"
          busyLabel="Đang rời…"
          tone="danger"
          onConfirm={() => blocker.proceed()}
          onClose={() => blocker.reset()}
        >
          Các thay đổi chưa lưu sẽ mất.
        </ConfirmDialog>
      )}
    </form>
  );
}

/** Ô mô tả nhiều dòng, cùng kiểu với `Field` (design-system §9.4), có đếm ký tự */
function TextArea({
  label,
  value,
  error,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const messageId = `${id}-message`;
  return (
    <div className={styles.textField}>
      <label htmlFor={id} className={styles.textLabel}>
        {label}
        <span className={styles.required} aria-hidden="true">
          {' '}
          *
        </span>
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        rows={5}
        required
        aria-required
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        maxLength={LIMITS.description}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={messageId} className={error ? styles.textError : styles.textHint}>
        {error ? (
          <>
            <CircleAlert size={16} aria-hidden="true" />
            {error}
          </>
        ) : (
          `2–3 câu: dành cho ai, điểm nổi bật, nên mua kèm gì. ${value.length}/${LIMITS.description} ký tự.`
        )}
      </p>
    </div>
  );
}
