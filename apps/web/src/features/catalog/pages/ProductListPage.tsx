import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { ProductListResponse } from '../../../shared/api/types';
import { ProductCard } from '../components/ProductCard';
import {
  CATEGORIES,
  DEFAULT_SORT,
  SORTS,
  filtersFromSearchParams,
  toProductsQuery,
} from '../lib/productFilters';
import styles from './ProductListPage.module.css';

/**
 * Danh sách sản phẩm. URL là nguồn sự thật của bộ lọc (/products?q=rtx&category=gpu&sort=price_asc):
 * chia sẻ link được, F5 không mất. Từ khoá nhập ở ô tìm kiếm trên header.
 */
export function ProductListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = filtersFromSearchParams(searchParams);
  const categoryLabel = CATEGORIES.find((c) => c.value === filters.category)?.label;

  // Đổi loại hoặc cách sắp xếp: ghi vào URL; giá trị rỗng hoặc mặc định thì xoá khỏi URL
  const changeParam = (key: 'category' | 'sort', value: string, defaultValue = '') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value && value !== defaultValue) next.set(key, value);
      else next.delete(key);
      return next;
    });
  };

  const { data, isLoading, isError, isFetching, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      // Bộ lọc nằm trong key → đổi từ khoá hay loại là query mới, cache riêng
      queryKey: queryKeys.products.list({ ...filters }),
      queryFn: ({ pageParam }) =>
        api.get<ProductListResponse>(`/products${toProductsQuery(filters, pageParam)}`),
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      // Giữ kết quả cũ trên màn hình trong lúc chờ kết quả mới → không nhấp nháy
      placeholderData: keepPreviousData,
    });

  const products = data?.pages.flatMap((page) => page.items) ?? [];
  const heading = filters.q ? `Kết quả cho “${filters.q}”` : (categoryLabel ?? 'Tất cả sản phẩm');

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <h1 className={styles.heading}>{heading}</h1>
          {filters.q && categoryLabel && <p className={styles.scope}>Trong mục {categoryLabel}</p>}
        </div>
        <div className={styles.filters}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Loại</span>
            <select
              value={filters.category ?? ''}
              onChange={(e) => changeParam('category', e.target.value)}
            >
              <option value="">Tất cả loại</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Sắp xếp</span>
            <select
              value={filters.sort ?? DEFAULT_SORT}
              onChange={(e) => changeParam('sort', e.target.value, DEFAULT_SORT)}
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {isLoading && <p className={styles.message}>Đang tải sản phẩm…</p>}
      {isError && (
        <p className={styles.message} role="alert">
          Chưa tải được sản phẩm. Tải lại trang để thử lần nữa.
          {import.meta.env.DEV && ' (Khi chạy dev: kiểm tra mock Prism đã chạy ở cổng 4010 chưa.)'}
        </p>
      )}

      {!isLoading && !isError && products.length === 0 && (
        <div className={styles.empty}>
          <p>
            {filters.q
              ? `Không có sản phẩm nào có “${filters.q}” trong tên.`
              : 'Mục này chưa có sản phẩm.'}
          </p>
          <Link to="/products">Xem tất cả sản phẩm</Link>
        </div>
      )}

      <ul className={styles.grid} aria-busy={isFetching && !isFetchingNextPage}>
        {products.map((product) => (
          <li key={product.productId}>
            <ProductCard product={product} />
          </li>
        ))}
      </ul>

      {/* Phân trang bằng cursor (BR-01) */}
      {hasNextPage && (
        <div className={styles.more}>
          <button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Đang tải…' : 'Xem thêm sản phẩm'}
          </button>
        </div>
      )}
    </div>
  );
}
