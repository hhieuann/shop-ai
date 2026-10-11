import { Link } from 'react-router-dom';
import type { ProductSummary } from '../../../shared/api/types';
import { Price } from '../../../shared/components/Price';
import { CategoryIcon } from './CategoryIcon';
import { StockBadge } from './StockBadge';
import styles from './ProductCard.module.css';

/**
 * Thẻ sản phẩm (design-system §9.9): thẻ trắng bo 12px, ô ảnh vuông chạm mép, tên một dòng,
 * giá và nhãn tồn kho cùng hàng. Cả thẻ bấm được nhờ link tiêu đề phủ kín thẻ.
 */
export function ProductCard({ product }: { product: ProductSummary }) {
  const unavailable = product.status !== 'ACTIVE' || product.stock <= 0;
  return (
    <article className={`${styles.card} ${unavailable ? styles.unavailable : ''}`}>
      <div className={styles.plate}>
        {product.imageUrl ? (
          <img
            className={styles.image}
            src={product.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={240}
            height={240}
          />
        ) : (
          <span className={styles.noImage}>
            <CategoryIcon category={product.category} size={56} />
          </span>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link className={styles.link} to={`/products/${product.productId}`} title={product.name}>
            {product.name}
          </Link>
        </h3>
        <div className={styles.footer}>
          <Price amount={product.price} />
          <StockBadge stock={product.stock} status={product.status} size="sm" />
        </div>
      </div>
    </article>
  );
}
