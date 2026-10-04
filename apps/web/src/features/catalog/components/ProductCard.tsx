import { Link } from 'react-router-dom';
import type { ProductSummary } from '../../../shared/api/types';
import { Price } from '../../../shared/components/Price';
import { CategoryIcon } from './CategoryIcon';
import { StockBadge } from './StockBadge';
import styles from './ProductCard.module.css';

/**
 * Thẻ sản phẩm: thẻ tối, ảnh nằm trên ô nền sáng (ảnh của hãng có nền trắng),
 * tên 2 dòng, hãng, giá, nhãn tồn kho. Cả thẻ là một link.
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
            width={168}
            height={168}
          />
        ) : (
          <span className={styles.noImage}>
            <CategoryIcon category={product.category} size={48} />
          </span>
        )}
      </div>
      <div className={styles.body}>
        <h3 className={styles.title}>
          <Link className={styles.link} to={`/products/${product.productId}`}>
            {product.name}
          </Link>
        </h3>
        <p className={styles.brand}>{product.brand}</p>
        <div className={styles.footer}>
          <Price amount={product.price} />
          <StockBadge stock={product.stock} status={product.status} />
        </div>
      </div>
    </article>
  );
}
