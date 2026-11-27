import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Breadcrumb } from '../../../shared/components/Breadcrumb';
import { CategoryIcon } from '../components/CategoryIcon';
import { ProductImage } from '../components/ProductImage';
import { PRODUCT_IMAGE_CREDITS } from '../lib/productImages';
import styles from './ImageCreditsPage.module.css';

/**
 * Trang "Nguồn ảnh" `/image-credits` (pages/nguon-anh.md, #530): ảnh sản phẩm demo thuộc về nhà sản
 * xuất, chỉ dùng minh hoạ cho dự án học tập; liệt kê từng món với hãng và trang sản phẩm của hãng (nếu có).
 */
export function ImageCreditsPage() {
  useEffect(() => {
    const previous = document.title;
    document.title = 'Nguồn ảnh sản phẩm | Black Magic';
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className={styles.page}>
      <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Nguồn ảnh' }]} />
      <h1 className={styles.heading}>Nguồn ảnh sản phẩm</h1>
      <div className={styles.notice}>
        <p>
          Ảnh sản phẩm trên trang thuộc về nhà sản xuất của từng sản phẩm, chỉ dùng minh hoạ cho dự
          án học tập (chương trình First Cloud AI Journey 2026). Sản phẩm, giá và tồn kho là dữ liệu
          demo, shop không bán hàng thật.
        </p>
        <p>Chúng tôi sẽ gỡ ảnh nếu nhà sản xuất hoặc chủ sở hữu ảnh yêu cầu.</p>
      </div>

      <ul className={styles.list}>
        {PRODUCT_IMAGE_CREDITS.map((c) => (
          <li key={c.productId} className={styles.row}>
            <span className={styles.thumb}>
              <ProductImage
                productId={c.productId}
                alt=""
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
                fallback={<CategoryIcon category={c.category} size={24} />}
              />
            </span>
            <span className={styles.info}>
              <span className={styles.name}>{c.name}</span>
              <span className={styles.meta}>
                Ảnh thuộc về {c.brand}
                {c.page && (
                  <>
                    {' · '}
                    <a
                      href={c.page}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.link}
                    >
                      Trang sản phẩm của hãng
                      <ExternalLink size={14} aria-hidden="true" />
                      <span className="sr-only"> (mở thẻ mới)</span>
                    </a>
                  </>
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
