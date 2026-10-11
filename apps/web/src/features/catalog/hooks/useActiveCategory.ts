import { useLocation, useSearchParams } from 'react-router-dom';
import { CATEGORIES, type ProductCategory } from '../lib/productFilters';

/** Loại hàng đang xem: chỉ có ở trang danh sách (/products?category=…) */
export function useActiveCategory(): ProductCategory | undefined {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  if (location.pathname !== '/products') return undefined;
  const value = searchParams.get('category');
  return CATEGORIES.find((c) => c.value === value)?.value;
}
