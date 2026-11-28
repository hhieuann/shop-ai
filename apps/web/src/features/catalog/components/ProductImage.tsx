import { useState, type ImgHTMLAttributes, type ReactNode } from 'react';
import { demoImageSrc } from '../lib/productImages';

type ImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'>;

/**
 * Ảnh sản phẩm (design-system §9.34, #530). Thứ tự nguồn:
 * 1. `imageUrl` từ API (ảnh admin tải lên hoặc dán, luôn ưu tiên);
 * 2. ảnh demo `/product-images/<productId>.webp` nếu món có trong bộ ảnh demo;
 * 3. `fallback` (icon loại hàng) khi không có ảnh nào hoặc mọi ảnh đều tải lỗi.
 *
 * `<img>` có `data-source` = `api` hoặc `demo` theo nguồn đang hiện: ảnh demo đã xuất sẵn lề nên
 * phủ kín ô (`cover`); ảnh API có thể đủ mọi tỉ lệ nên giữ `contain` và lề của ô như trước.
 */
export function ProductImage({
  productId,
  imageUrl,
  fallback,
  ...img
}: ImgProps & {
  productId: string;
  imageUrl?: string;
  fallback: ReactNode;
}) {
  const sources = [imageUrl, demoImageSrc(productId)].filter((s): s is string => Boolean(s));
  // Ghi nhớ nguồn đã lỗi: đổi món hoặc đổi imageUrl thì tự thử lại từ đầu
  const [failed, setFailed] = useState<readonly string[]>([]);
  const src = sources.find((s) => !failed.includes(s));
  if (!src) return <>{fallback}</>;
  return (
    <img
      {...img}
      src={src}
      data-source={src === imageUrl ? 'api' : 'demo'}
      onError={() => setFailed((f) => [...f, src])}
    />
  );
}
