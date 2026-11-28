import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Copy, Eye, EyeOff, Pencil, Plus, RotateCcw, Search, Trash2 } from 'lucide-react';
import { api, ApiError } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type {
  AdminProduct,
  AdminProductList,
  AdminProductStatusFilter,
  ProductCategory,
} from '../../../shared/api/types';
import { ActionMenu } from '../../../shared/components/ActionMenu';
import { buttonClass } from '../../../shared/components/buttonClass';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { CursorPager, type PagerTarget } from '../../../shared/components/CursorPager';
import { Price } from '../../../shared/components/Price';
import { Select } from '../../../shared/components/Select';
import { ToastProvider } from '../../../shared/components/Toast';
import { useToast } from '../../../shared/components/toastContext';
import { CategoryIcon } from '../../catalog/components/CategoryIcon';
import { CATEGORIES, categoryLabel } from '../../catalog/lib/productFilters';
import { AdminForbidden } from '../components/AdminForbidden';
import {
  ADMIN_SEARCH_MAX,
  adminProductsQuery,
  adminProductsSearch,
  readAdminProductFilters,
  type AdminProductFilters,
} from '../lib/adminProductFilters';
import styles from './AdminProductsPage.module.css';

/** 20 món mỗi trang (mặc định của API, catalog.md BR-10) */
const PAGE_SIZE = 20;
/** Gõ xong 300 ms thì tìm (pages/admin-san-pham.md mục 2) */
const SEARCH_DELAY_MS = 300;
/** Từ 3 trở xuống thì tồn kho màu cảnh báo; 0 là "Hết hàng" */
const LOW_STOCK = 3;

/** Nút phân đoạn: nhãn và số đếm lấy từ `counts` (Tất cả = đang bán + đã ẩn) */
const SEGMENTS: {
  status?: AdminProductStatusFilter;
  label: string;
  count: (c: AdminProductList['counts']) => number;
}[] = [
  { label: 'Tất cả', count: (c) => c.active + c.inactive },
  { status: 'ACTIVE', label: 'Đang bán', count: (c) => c.active },
  { status: 'INACTIVE', label: 'Đã ẩn', count: (c) => c.inactive },
  { status: 'DELETED', label: 'Đã xoá', count: (c) => c.deleted },
];

/** location.state: cursor các trang trước (như trang đơn admin, không lên URL) */
interface PageState {
  prevCursors: (string | null)[];
}

function readPrevCursors(state: unknown, page: number): (string | null)[] | undefined {
  const list = (state as Partial<PageState> | null)?.prevCursors;
  if (!Array.isArray(list) || list.length !== page - 1) return undefined;
  return list.every((c) => c === null || typeof c === 'string') ? list : undefined;
}

/** Thao tác trên một dòng (pages/admin-san-pham.md mục 2 "Thao tác") */
type RowAction = 'hide' | 'show' | 'delete' | 'restore';

/**
 * Quản trị sản phẩm `/admin/products` (pages/admin-san-pham.md mục 2, catalog.md BR-10 … BR-14):
 * danh sách theo loại, lọc trạng thái, tìm tên, ẩn, hiện, xoá mềm, khôi phục. Nằm trong khung quản
 * trị (`AdminLayout`) đã kiểm đăng nhập, nhóm admin, xác thực hai lớp; API vẫn tự kiểm (403).
 */
export function AdminProductsPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Quản trị sản phẩm | Black Magic';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <ToastProvider>
      <AdminProducts />
    </ToastProvider>
  );
}

function AdminProducts() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const toast = useToast();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const filters = readAdminProductFilters(searchParams);
  const [forbidden, setForbidden] = useState(false);

  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.admin.products({ ...filters }),
    queryFn: () =>
      api.get<AdminProductList>(`/admin/products?${adminProductsQuery(filters, PAGE_SIZE)}`),
    // Dữ liệu quản trị: luôn đọc mới khi mở lại trang
    staleTime: 0,
  });

  /** Đổi bộ lọc: về trang 1; từ khoá đổi thì thay mục lịch sử thay vì thêm */
  const go = (next: Partial<AdminProductFilters>, replace = false) =>
    navigate(
      { search: adminProductsSearch({ ...filters, cursor: undefined, ...next }) },
      { replace },
    );

  // Trang sau trang 1 tải xong mà rỗng (vd. vừa xoá món cuối của trang): về trang 1, giữ bộ lọc,
  // thay mục lịch sử thay vì thêm (review #558)
  const emptyLaterPage =
    filters.page > 1 && data !== undefined && !error && data.items.length === 0;
  useEffect(() => {
    if (emptyLaterPage) go({}, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go tạo mới mỗi lần vẽ; chỉ chạy khi cờ đổi
  }, [emptyLaterPage]);

  // Thao tác đang chờ hỏi lại (chỉ xoá mới hỏi lại; ẩn, hiện, khôi phục làm ngay)
  const [toDelete, setToDelete] = useState<AdminProduct | null>(null);
  const action = useMutation({
    mutationFn: ({
      kind,
      product,
    }: {
      kind: RowAction;
      product: AdminProduct;
    }): Promise<AdminProduct | undefined> => {
      const path = `/admin/products/${product.productId}`;
      if (kind === 'delete') return api.delete<undefined>(path);
      if (kind === 'restore') return api.post<AdminProduct>(`${path}/restore`, {});
      return api.patch<AdminProduct>(path, {
        updatedAt: product.updatedAt,
        status: kind === 'hide' ? 'INACTIVE' : 'ACTIVE',
      });
    },
    onSuccess: (result, { kind, product }) => {
      setToDelete(null);
      // Khôi phục trả bản mới: trang sửa mở ngay sau đó dùng luôn bản này (review #559)
      if (kind === 'restore' && result) {
        queryClient.setQueryData(queryKeys.admin.product(result.productId), result);
      }
      toast.show(
        {
          hide: `Đã ẩn "${product.name}" khỏi cửa hàng.`,
          show: `Đã hiện lại "${product.name}".`,
          delete: `Đã xoá "${product.name}".`,
          restore: `Đã khôi phục "${product.name}". Sản phẩm đang ở trạng thái đã ẩn.`,
        }[kind],
      );
      void reload();
    },
    onError: (err) => {
      setToDelete(null);
      if (err instanceof ApiError && err.status === 403) return setForbidden(true);
      if (err instanceof ApiError && err.code === 'PRODUCT_CHANGED') {
        toast.show('Sản phẩm vừa được sửa ở nơi khác. Danh sách đã được tải lại.');
        return void reload();
      }
      if (err instanceof ApiError && err.status === 404) {
        toast.show('Không tìm thấy sản phẩm. Danh sách đã được tải lại.');
        return void reload();
      }
      toast.show('Chưa lưu được. Thử lại sau.');
    },
  });

  /** Tải lại danh sách và số đếm; dòng vừa đổi rời danh sách thì focus về tiêu đề */
  async function reload() {
    // Cả danh sách lẫn chi tiết: trang sửa mở sau đó không được dùng bản cũ (#559)
    await queryClient.invalidateQueries({ queryKey: queryKeys.admin.productsAll() });
    requestAnimationFrame(() => {
      const lost = document.activeElement === null || document.activeElement === document.body;
      if (lost) headingRef.current?.focus();
    });
  }

  if (forbidden || (error instanceof ApiError && error.status === 403)) return <AdminForbidden />;

  const prevCursors = readPrevCursors(location.state, filters.page);
  const next: PagerTarget | undefined = data?.nextCursor
    ? {
        to: {
          search: adminProductsSearch({
            ...filters,
            cursor: data.nextCursor,
            page: filters.page + 1,
          }),
        },
        state: {
          prevCursors: [
            ...(prevCursors ?? Array<null>(filters.page - 1).fill(null)),
            filters.cursor ?? '',
          ],
        } satisfies PageState,
      }
    : undefined;
  const previousCursor = prevCursors?.[filters.page - 2];
  const previous: PagerTarget | undefined =
    filters.page <= 1
      ? undefined
      : previousCursor
        ? {
            to: {
              search: adminProductsSearch({
                ...filters,
                cursor: previousCursor,
                page: filters.page - 1,
              }),
            },
            state: { prevCursors: prevCursors?.slice(0, -1) ?? [] } satisfies PageState,
          }
        : { to: { search: adminProductsSearch({ ...filters, cursor: undefined }) } };

  const products = data?.items ?? [];
  const sending = action.isPending;

  return (
    <div>
      <div className={styles.head}>
        <div>
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            Sản phẩm
          </h1>
          <p className={styles.lead}>
            Thêm, sửa, ẩn sản phẩm của từng loại. Món ẩn hoặc đã xoá khách không thấy.
          </p>
        </div>
        <Link
          to={`/admin/products/new?category=${filters.category}`}
          className={`${buttonClass({ variant: 'primary' })} ${styles.add}`}
        >
          <Plus size={20} aria-hidden="true" />
          Thêm sản phẩm
        </Link>
      </div>

      <section className={styles.block} aria-label="Danh sách sản phẩm">
        <div className={styles.toolbar}>
          <SearchBox initial={filters.q ?? ''} onSearch={(q) => go({ q: q || undefined }, true)} />
          <Select
            label="Loại hàng"
            hideLabel
            className={styles.category}
            options={CATEGORIES}
            value={filters.category}
            onChange={(e) => go({ category: e.target.value as ProductCategory })}
          />
          {/* Đổi lọc là đổi URL nên dùng link điều hướng, không dùng mẫu tab của ARIA */}
          <nav aria-label="Trạng thái sản phẩm" className={styles.segments}>
            {SEGMENTS.map((segment) => (
              <Link
                key={segment.label}
                to={{
                  search: adminProductsSearch({
                    ...filters,
                    cursor: undefined,
                    status: segment.status,
                  }),
                }}
                aria-current={filters.status === segment.status ? 'page' : undefined}
                className={styles.segment}
              >
                {segment.label}{' '}
                {data && <span className={styles.count}>{segment.count(data.counts)}</span>}
              </Link>
            ))}
          </nav>
        </div>

        {isPending || emptyLaterPage ? (
          <p className={styles.message}>Đang tải sản phẩm…</p>
        ) : error ? (
          <p role="alert" className={styles.message}>
            Chưa tải được danh sách sản phẩm. Tải lại trang để thử lần nữa.
          </p>
        ) : products.length === 0 ? (
          <EmptyMessage filters={filters} />
        ) : (
          <>
            {/* Điện thoại đổi display của dòng, ô sang grid: ghi vai trò tường minh để trình đọc màn
                hình vẫn đọc như bảng */}
            <table role="table" className={styles.table}>
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col">
                    Sản phẩm
                  </th>
                  <th role="columnheader" scope="col" className={styles.categoryCol}>
                    Loại
                  </th>
                  <th role="columnheader" scope="col" className={styles.num}>
                    Giá bán
                  </th>
                  <th role="columnheader" scope="col" className={styles.num}>
                    Tồn kho
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
                {products.map((product) => (
                  <ProductRow
                    key={product.productId}
                    product={product}
                    disabled={sending}
                    onAction={(kind) =>
                      kind === 'delete' ? setToDelete(product) : action.mutate({ kind, product })
                    }
                  />
                ))}
              </tbody>
            </table>
            <div className={styles.foot}>
              <p className={styles.footCount}>Hiện {products.length} sản phẩm</p>
              <CursorPager page={filters.page} previous={previous} next={next} />
            </div>
          </>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title="Xoá sản phẩm này?"
          confirmLabel="Xoá sản phẩm"
          cancelLabel="Giữ lại"
          busyLabel="Đang xoá…"
          tone="danger"
          busy={action.isPending}
          onConfirm={() => action.mutate({ kind: 'delete', product: toDelete })}
          onClose={() => setToDelete(null)}
        >
          <span className={styles.dialogBody}>
            <span className={styles.trash} aria-hidden="true">
              <Trash2 size={20} />
            </span>
            <span>
              <strong className={styles.dialogName}>{toDelete.name}</strong> sẽ không hiện ở cửa
              hàng nữa. Đơn cũ vẫn giữ món này. Bạn có thể khôi phục ở mục "Đã xoá".
            </span>
          </span>
        </ConfirmDialog>
      )}
    </div>
  );
}

/** Ô tìm theo tên: gửi khi Enter hoặc sau 300 ms ngừng gõ (pages/admin-san-pham.md mục 2) */
function SearchBox({ initial, onSearch }: { initial: string; onSearch: (q: string) => void }) {
  const [value, setValue] = useState(initial);
  // Từ khoá ô này vừa gửi lên URL. URL đổi đúng bằng từ khoá này là do chính ô gửi: giữ nguyên chữ
  // đang gõ (không tạo lại ô, không mất focus, review #558)
  const sentRef = useRef(initial);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  // URL đổi từ ngoài (back, forward, bấm link): ô hiện từ khoá của URL
  useEffect(() => {
    if (initial === sentRef.current) return;
    sentRef.current = initial;
    setValue(initial);
  }, [initial]);

  const send = (q: string) => {
    sentRef.current = q;
    onSearchRef.current(q);
  };

  useEffect(() => {
    const q = value.trim();
    if (q === sentRef.current) return;
    const timer = setTimeout(() => send(q), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [value]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (value.trim() !== sentRef.current) send(value.trim());
  };

  return (
    <form role="search" className={styles.search} onSubmit={submit}>
      <Search size={18} aria-hidden="true" className={styles.searchIcon} />
      <input
        type="search"
        aria-label="Tìm sản phẩm theo tên"
        placeholder="Tìm theo tên"
        maxLength={ADMIN_SEARCH_MAX}
        className={styles.searchInput}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}

function ProductRow({
  product,
  disabled,
  onAction,
}: {
  product: AdminProduct;
  disabled: boolean;
  onAction: (kind: RowAction) => void;
}) {
  const navigate = useNavigate();
  const deleted = product.deletedAt !== undefined;
  const editPath = `/admin/products/${product.productId}/edit`;
  return (
    <tr role="row" className={styles.row}>
      <td role="cell" className={styles.product}>
        <span className={styles.thumb} aria-hidden="true">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt="" loading="lazy" />
          ) : (
            <CategoryIcon category={product.category} size={20} />
          )}
        </span>
        <span className={styles.names}>
          <span className={styles.name}>{product.name}</span>
          <span className={styles.brand}>{product.brand}</span>
        </span>
      </td>
      <td role="cell" className={`${styles.categoryCol} ${styles.muted}`}>
        {categoryLabel(product.category)}
      </td>
      <td role="cell" className={`${styles.num} ${styles.price}`}>
        <Price amount={product.price} />
      </td>
      <td role="cell" className={`${styles.num} ${styles.stock}`}>
        <span className={styles.stockLabel}>Tồn kho: </span>
        {product.stock === 0 ? (
          <span className={styles.out}>Hết hàng</span>
        ) : (
          <span className={product.stock <= LOW_STOCK ? styles.low : undefined}>
            {product.stock}
          </span>
        )}
      </td>
      <td role="cell" className={styles.statusCell}>
        <StatusPill product={product} />
      </td>
      <td role="cell" className={styles.actionCell}>
        <div className={styles.actions}>
          {deleted ? (
            <button
              type="button"
              className={buttonClass({ size: 'sm' })}
              aria-label={`Khôi phục: ${product.name}`}
              disabled={disabled}
              onClick={() => onAction('restore')}
            >
              <RotateCcw size={16} aria-hidden="true" />
              Khôi phục
            </button>
          ) : (
            <>
              <Link to={editPath} className={styles.iconButton} aria-label={`Sửa: ${product.name}`}>
                <Pencil size={18} aria-hidden="true" />
              </Link>
              <ActionMenu
                label={`Thao tác khác: ${product.name}`}
                disabled={disabled}
                items={[
                  { label: 'Sửa', icon: Pencil, onSelect: () => navigate(editPath) },
                  {
                    label: 'Nhân bản',
                    icon: Copy,
                    onSelect: () => navigate(`/admin/products/new?from=${product.productId}`),
                  },
                  product.status === 'ACTIVE'
                    ? { label: 'Ẩn khỏi cửa hàng', icon: EyeOff, onSelect: () => onAction('hide') }
                    : { label: 'Hiện lại', icon: Eye, onSelect: () => onAction('show') },
                  {
                    label: 'Xoá',
                    icon: Trash2,
                    tone: 'danger',
                    separatorBefore: true,
                    onSelect: () => onAction('delete'),
                  },
                ]}
              />
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatusPill({ product }: { product: AdminProduct }) {
  if (product.deletedAt !== undefined) {
    return <span className={`${styles.pill} ${styles.pillDeleted}`}>Đã xoá</span>;
  }
  return product.status === 'ACTIVE' ? (
    <span className={`${styles.pill} ${styles.pillActive}`}>Đang bán</span>
  ) : (
    <span className={`${styles.pill} ${styles.pillHidden}`}>Đã ẩn</span>
  );
}

function EmptyMessage({ filters }: { filters: AdminProductFilters }) {
  if (filters.q) {
    return <p className={styles.message}>Không có sản phẩm khớp "{filters.q}".</p>;
  }
  if (filters.status === 'DELETED') {
    return <p className={styles.message}>Chưa xoá sản phẩm nào.</p>;
  }
  return (
    <div className={styles.message}>
      <p className={styles.messageText}>Chưa có sản phẩm nào trong loại này.</p>
      <Link to={`/admin/products/new?category=${filters.category}`} className={styles.link}>
        Thêm sản phẩm
      </Link>
    </div>
  );
}
