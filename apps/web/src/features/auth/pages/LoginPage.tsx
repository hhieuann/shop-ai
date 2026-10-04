import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithDevToken } from '../../../shared/auth/token';

/**
 * TRANG TẠM. Đăng nhập thật bằng Cognito do An làm; khi xong, An thay file này.
 * Hợp đồng với các trang khác (giữ nguyên khi thay):
 *   - Được mở bằng navigate('/login', { state: { from: '<đường dẫn cần quay lại>' } })
 *   - Đăng nhập xong thì navigate(from, { replace: true })
 */
export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const from: string = location.state?.from ?? '/products';

  const devLogin = () => {
    if (signInWithDevToken()) navigate(from, { replace: true });
  };

  return (
    <div style={{ maxWidth: '420px', margin: '3rem auto', textAlign: 'center' }}>
      <h1>Đăng nhập</h1>
      <p>Bạn cần đăng nhập để dùng giỏ hàng và đặt hàng.</p>
      {import.meta.env.DEV ? (
        <>
          <button onClick={devLogin} style={{ padding: '0.6rem 1.5rem' }}>
            Đăng nhập thử (token giả, chỉ khi dev)
          </button>
          <p style={{ color: 'var(--fg-subdued)', fontSize: '0.85rem' }}>
            Trang tạm để thử luồng trên mock Prism. Đăng nhập Cognito thật do An làm.
          </p>
        </>
      ) : (
        <p style={{ color: 'var(--fg-subdued)' }}>Tính năng đăng nhập đang được hoàn thiện.</p>
      )}
    </div>
  );
}
