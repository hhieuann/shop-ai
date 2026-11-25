import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../shared/api/client';
import { queryKeys } from '../../../shared/api/queryKeys';
import type { AdminProduct, AdminProductList, ProductCategory } from '../../../shared/api/types';
import { Button } from '../../../shared/components/Button';
import { Select } from '../../../shared/components/Select';
import { categoryLabel } from '../../catalog/lib/productFilters';
import styles from './CopyFromPanel.module.css';

/**
 * "Sao chép từ sản phẩm có sẵn" (pages/admin-san-pham.md mục 3): chọn một món cùng loại (đang bán
 * hoặc đã ẩn, tối đa 50 món mới nhất) rồi điền form. Trang tự bỏ tên, giá, tồn kho, ảnh.
 */
export function CopyFromPanel({
  category,
  onCopy,
  onClose,
}: {
  category: ProductCategory;
  onCopy: (product: AdminProduct) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState('');
  const params = { category, limit: 50 };
  const { data, isPending, error } = useQuery({
    queryKey: queryKeys.admin.products(params),
    queryFn: () =>
      api.get<AdminProductList>(`/admin/products?category=${category}&limit=${params.limit}`),
  });
  const items = data?.items ?? [];
  const product = items.find((p) => p.productId === selected);

  return (
    <section className={styles.panel} aria-label="Sao chép từ sản phẩm có sẵn">
      {isPending ? (
        <p className={styles.note}>Đang tải sản phẩm…</p>
      ) : error ? (
        <p role="alert" className={styles.note}>
          Chưa tải được danh sách sản phẩm.
        </p>
      ) : items.length === 0 ? (
        <p className={styles.note}>Chưa có sản phẩm nào trong loại {categoryLabel(category)}.</p>
      ) : (
        <Select
          label={`Sản phẩm ${categoryLabel(category)} có sẵn`}
          options={[
            { value: '', label: 'Chọn sản phẩm' },
            ...items.map((p) => ({ value: p.productId, label: p.name })),
          ]}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          hint="Điền mọi ô trừ tên, giá, tồn kho và ảnh."
        />
      )}
      <div className={styles.actions}>
        <Button size="sm" onClick={onClose}>
          Đóng
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!product}
          onClick={() => product && onCopy(product)}
        >
          Điền từ sản phẩm này
        </Button>
      </div>
    </section>
  );
}
