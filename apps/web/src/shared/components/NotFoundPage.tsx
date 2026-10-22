import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', paddingTop: '4rem' }}>
      <h1>404 — Không tìm thấy trang</h1>
      <p>Trang bạn tìm không tồn tại.</p>
      <Link to="/">Về trang chủ</Link>
    </div>
  );
}
