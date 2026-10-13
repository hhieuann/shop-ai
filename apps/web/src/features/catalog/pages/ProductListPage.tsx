import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { SlidersHorizontal } from 'lucide-react';
import { ApiError, api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { ProductListResponse } from '../../../shared/api/types';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { CursorPager, type PagerTarget } from '../../../shared/components/CursorPager';
import { LiveAnnouncerProvider } from '../../../shared/components/LiveAnnouncer';
import { DESKTOP_QUERY, useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { FilterPanel } from '../components/FilterPanel';
import { FilterSheet } from '../components/FilterSheet';
import { ProductListCard } from '../components/ProductListCard';
import {
  CATEGORIES,
  DEFAULT_SORT,
  SORTS,
  filtersFromSearchParams,
  pageFromSearchParams,
  toProductsQuery,
  withFilter,
  withPage,
  type ProductCategory,
} from '../lib/productFilters';
import styles from './ProductListPage.module.css';

/**
 * location.state của trang danh sách: cursor các trang trước trang đang xem (không lên URL).
 * Phần tử i là cursor của trang i + 1 ('' là trang 1, null là không biết vì mở từ link chia sẻ).
 */
interface ListState {
  prevCursors: (string | null)[];
}

/** Đọc state; chỉ tin khi đủ page − 1 phần tử đúng kiểu (sửa tay URL, tab mới thì không có) */
function readPrevCursors(state: unknown, page: number): (string | null)[] | undefined {
  const list = (state as Partial<ListState> | null)?.prevCursors;
  if (!Array.isArray(list) || list.length !== page - 1) return undefined;
  return list.every((c) => c === null || typeof c === 'string') ? list : undefined;
}

const toSearch = (params: URLSearchParams) => {
  const s = params.toString();
  return s ? `?${s}` : '';
};

/**
 * Danh sách và kết quả tìm kiếm (docs/web/pages/danh-sach-san-pham.md). URL là nguồn sự thật
 * của bộ lọc và trang đang xem: /products?q=rtx&category=gpu&sort=price_asc&cursor=…&page=2.
 * Mỗi lần một trang 20 sản phẩm theo cursor; API không trả tổng số nên chỉ có "Trước · Trang N · Sau".
 */
export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const filters = filtersFromSearchParams(searchParams);
  const { cursor, page } = pageFromSearchParams(searchParams);
  const categoryLabel = CATEGORIES.find((c) => c.value === filters.category)?.label;
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusAfterPaging = useRef(false);

  const { data, isPending, isError, error, isFetching, isPlaceholderData } = useQuery({
    // Bộ lọc và cursor nằm trong key: mỗi trang một cache, Back về trang trước có ngay
    queryKey: queryKeys.products.list({ ...filters, cursor }),
    queryFn: () => api.get<ProductListResponse>(`/products${toProductsQuery(filters, cursor)}`),
    // Giữ kết quả cũ trên màn hình trong lúc chờ trang hoặc bộ lọc mới → không nhấp nháy
    placeholderData: keepPreviousData,
  });

  // Cursor trên URL hỏng hoặc hết hạn (API trả 400): về trang 1, thay mục lịch sử, không báo lỗi
  const badCursor = Boolean(cursor) && error instanceof ApiError && error.status === 400;
  useEffect(() => {
    if (badCursor) setSearchParams((prev) => withPage(prev, undefined, 1), { replace: true });
  }, [badCursor, setSearchParams]);

  // Đổi loại hoặc cách sắp xếp: về trang 1 (thêm mục lịch sử, Back quay lại bộ lọc trước)
  const changeFilter = (key: 'category' | 'sort', value: string | undefined) => {
    setSearchParams((prev) => withFilter(prev, key, value));
  };

  // Màn hình rộng ra qua 1280px trong lúc bảng lọc đang mở: đóng bảng (đã có cột lọc)
  useEffect(() => {
    if (desktop) setSheetOpen(false);
  }, [desktop]);

  // Sau khi bấm Trước/Sau: cuộn lên đầu và đưa focus về tiêu đề để đọc lại từ đầu danh sách
  useEffect(() => {
    if (!focusAfterPaging.current) return;
    focusAfterPaging.current = false;
    window.scrollTo({ top: 0 });
    headingRef.current?.focus({ preventScroll: true });
  }, [location.key]);

  const heading = filters.q ? `Kết quả cho “${filters.q}”` : (categoryLabel ?? 'Tất cả sản phẩm');
  const scope = filters.q && categoryLabel ? `Trong mục ${categoryLabel}` : undefined;
  const crumb = filters.q ? `Tìm kiếm “${filters.q}”` : (categoryLabel ?? 'Tất cả sản phẩm');

  useEffect(() => {
    const previous = document.title;
    document.title = `${heading}${page > 1 ? ` – Trang ${page}` : ''} | Black Magic`;
    return () => {
      document.title = previous;
    };
  }, [heading, page]);

  // Chuyển trang: Sau đi theo nextCursor của trang đang xem; Trước lấy cursor trong state
  const prevCursors = readPrevCursors(location.state, page);
  const nextCursor = isPlaceholderData ? undefined : data?.nextCursor;
  const next: PagerTarget | undefined = nextCursor
    ? {
        to: { search: toSearch(withPage(searchParams, nextCursor, page + 1)) },
        state: {
          prevCursors: [...(prevCursors ?? Array<null>(page - 1).fill(null)), cursor ?? ''],
        } satisfies ListState,
      }
    : undefined;
  const previous = previousTarget(searchParams, page, prevCursors);

  const products = data?.items ?? [];
  const empty = !isPending && !isError && products.length === 0;
  const loadingFirst = isPending || badCursor;
  const sort = filters.sort ?? DEFAULT_SORT;

  return (
    <LiveAnnouncerProvider>
      <div className={styles.page}>
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: crumb }]} />
        <div className={styles.titleBlock}>
          <h1 ref={headingRef} tabIndex={-1} className={styles.heading}>
            {heading}
          </h1>
          {scope && <p className={styles.scope}>{scope}</p>}
        </div>

        <div className={styles.layout}>
          <div className={styles.side}>
            <FilterPanel
              category={filters.category}
              onCategoryChange={(c) => changeFilter('category', c)}
            />
          </div>

          <div className={styles.results}>
            {!empty && (
              <div className={styles.bar}>
                {/* Dưới 1280px: chip sắp xếp + nút "Lọc" */}
                <div className={styles.chips} role="group" aria-label="Sắp xếp">
                  {SORTS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      className={styles.chip}
                      aria-pressed={sort === s.value}
                      onClick={() => changeFilter('sort', s.value)}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <FilterButton
                  category={filters.category}
                  expanded={sheetOpen}
                  onClick={() => setSheetOpen(true)}
                />
                {/* Từ 1280px: select "Sắp xếp" bên phải */}
                <label className={styles.sort}>
                  <span className={styles.sortLabel}>Sắp xếp</span>
                  <select
                    className={styles.select}
                    value={sort}
                    onChange={(e) => changeFilter('sort', e.target.value)}
                  >
                    {SORTS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {loadingFirst && <p className={styles.message}>Đang tải sản phẩm…</p>}
            {isError && !badCursor && (
              <p className={styles.message} role="alert">
                Chưa tải được sản phẩm. Tải lại trang để thử lần nữa.
                {import.meta.env.DEV &&
                  ' (Khi chạy dev: kiểm tra mock Prism đã chạy ở cổng 4010 chưa.)'}
              </p>
            )}

            {empty ? (
              <div className={styles.empty}>
                <p>
                  {filters.q
                    ? `Không có sản phẩm nào có “${filters.q}” trong tên.`
                    : 'Mục này chưa có sản phẩm.'}
                </p>
                <Link to="/products">Xem tất cả sản phẩm</Link>
              </div>
            ) : (
              products.length > 0 && (
                <>
                  <ul className={styles.grid} aria-busy={isFetching && isPlaceholderData}>
                    {products.map((product) => (
                      <li key={product.productId} className={styles.item}>
                        <ProductListCard product={product} />
                      </li>
                    ))}
                  </ul>
                  <CursorPager
                    page={page}
                    previous={previous}
                    next={next}
                    onNavigate={() => {
                      focusAfterPaging.current = true;
                    }}
                  />
                </>
              )
            )}
          </div>
        </div>

        {sheetOpen && !desktop && (
          <FilterSheet
            category={filters.category}
            onApply={(c) => {
              setSheetOpen(false);
              changeFilter('category', c);
            }}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </div>
    </LiveAnnouncerProvider>
  );
}

/**
 * Đích của nút "Trước". Biết cursor trang trước (state) thì về đúng trang đó; trang 2, hoặc không
 * biết cursor (mở từ link chia sẻ, tab mới) thì về trang 1. Đang ở trang 1 thì không có.
 */
function previousTarget(
  params: URLSearchParams,
  page: number,
  prevCursors: (string | null)[] | undefined,
): PagerTarget | undefined {
  if (page <= 1) return undefined;
  const cursor = prevCursors?.[page - 2];
  if (!prevCursors || !cursor) return { to: { search: toSearch(withPage(params, undefined, 1)) } };
  return {
    to: { search: toSearch(withPage(params, cursor, page - 1)) },
    state: { prevCursors: prevCursors.slice(0, -1) } satisfies ListState,
  };
}

/** Nút "Lọc" (dưới 1280px) mở bảng lọc; có số bộ lọc đang chọn */
function FilterButton({
  category,
  expanded,
  onClick,
}: {
  category?: ProductCategory;
  expanded: boolean;
  onClick: () => void;
}) {
  const count = category ? 1 : 0;
  return (
    <button
      type="button"
      className={styles.filterButton}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      onClick={onClick}
    >
      <SlidersHorizontal size={18} aria-hidden="true" />
      Lọc
      {count > 0 && (
        <>
          <span className={styles.count} aria-hidden="true">
            {count}
          </span>
          <span className="sr-only">, {count} bộ lọc đang chọn</span>
        </>
      )}
    </button>
  );
}
