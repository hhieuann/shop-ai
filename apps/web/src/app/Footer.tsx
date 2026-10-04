import styles from './Footer.module.css';

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <p className={styles.brand}>Black Magic</p>
        <p className={styles.note}>
          Laptop và linh kiện PC. Thanh toán khi nhận hàng, miễn phí vận chuyển.
        </p>
        <p className={styles.note}>
          Dự án thực tập First Cloud AI Journey 2026. Dữ liệu sản phẩm là dữ liệu mẫu.
        </p>
      </div>
    </footer>
  );
}
