import { Link } from 'react-router-dom';
import type { ProductSummary } from '../../../shared/api/types';
import { Price } from '../../../shared/components/Price';
import { AddToCartButton } from '../../cart/components/AddToCartButton';
import { specSummary } from '../lib/specSummary';
import { CategoryIcon } from './CategoryIcon';
import { StockBadge } from './StockBadge';
import styles from './ProductListCard.module.css';

/**
 * Thẻ sản phẩm của trang danh sách (design-system §9.19): không khung, ô ảnh có nhãn tồn kho,
 * hãng, tên 2 dòng, dòng thông số, giá cỡ title, nút thêm vào giỏ. Cả thẻ bấm được nhờ ::after
 * của link tên; nút nằm trên lớp đó. Trang chủ dùng ProductCard, không dùng thẻ này.
 */
export function ProductListCard({ product }: { product: ProductSummary }) {
  const unavailable = product.status !== 'ACTIVE' || product.stock <= 0;
  const summary = specSummary(product.category, product.specs);

  return (
    <article className={`${styles.card} ${unavailable ? styles.unavailable : ''}`}>
      <div className={styles.plate}>
        <span className={styles.badge}>
          <StockBadge stock={product.stock} status={product.status} />
        </span>
        {product.imageUrl ? (
          <img
            className={styles.image}
            src={product.imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            width={259}
            height={236}
          />
        ) : (
          <span className={styles.noImage}>
            <CategoryIcon category={product.category} size={64} />
          </span>
        )}
      </div>
      <p className={styles.brand}>{product.brand}</p>
      <h3 className={styles.title}>
        <Link className={styles.link} to={`/products/${product.productId}`}>
          {product.name}
        </Link>
      </h3>
      <p className={styles.specs}>{summary}</p>
      <div className={styles.price}>
        <Price amount={product.price} size="title" />
      </div>
      <div className={styles.action}>
        <AddToCartButton product={product} />
      </div>
    </article>
  );
}
