import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import styles from './ImagePreview.module.css';

/**
 * Khung xem ảnh 4:3 của form sản phẩm (pages/admin-san-pham.md mục 3): chưa có đường dẫn thì
 * "Chưa có ảnh", ảnh tải lỗi thì báo, không chặn lưu (đường dẫn có thể chỉ sống ở môi trường khác).
 */
export function ImagePreview({ url }: { url: string }) {
  // Lỗi gắn với đúng đường dẫn đã thử: đổi đường dẫn thì tự thử lại
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = url.trim();
  const valid = /^https:\/\/\S+$/.test(src);
  return (
    <div className={styles.frame}>
      {valid && failedUrl !== src ? (
        <img src={src} alt="" className={styles.image} onError={() => setFailedUrl(src)} />
      ) : (
        <span className={styles.empty}>
          <ImageOff size={28} aria-hidden="true" />
          {valid ? 'Không tải được ảnh từ đường dẫn này' : 'Chưa có ảnh'}
        </span>
      )}
    </div>
  );
}
