import { useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { signInWithDevToken } from '../../../shared/auth/token';
import { continueAfterSignIn } from '../../cart/lib/afterSignIn';

/**
 * TRANG TẠM. Đăng nhập thật bằng Cognito do An làm; khi xong, An thay file này.
 * Hợp đồng với các trang khác (giữ nguyên khi thay, xem docs/web/pages/dang-nhap.md §8):
 *   - Được mở bằng navigate('/login', { state: { from, reason? } })
 *     · from: đường dẫn cần quay lại
 *     · reason: 'checkout' khi khách vãng lai bấm "Đặt hàng" ở giỏ (hiện câu giải thích)
 *   - Đăng nhập HOẶC tạo tài khoản xong: gọi notifyAuthChanged() (token.ts), rồi
 *     `await continueAfterSignIn(navigate, queryClient, from)`. Hàm này gộp giỏ khách vào giỏ
 *     tài khoản và tự chuyển trang (checkout, giỏ hàng hoặc `from`); không tự navigate nữa.
 */
export function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const state = location.state as { from?: string; reason?: string } | null;
  const from = state?.from ?? '/products';

  const devLogin = async () => {
    if (signInWithDevToken()) await continueAfterSignIn(navigate, queryClient, from);
  };

  return (
    <div style={{ maxWidth: '420px', margin: '3rem auto', textAlign: 'center' }}>
      <h1>Đăng nhập</h1>
      <p>
        {state?.reason === 'checkout'
          ? 'Đăng nhập hoặc tạo tài khoản để đặt hàng. Các sản phẩm bạn đã chọn được giữ nguyên.'
          : 'Đăng nhập để xem đơn hàng và đặt hàng.'}
      </p>
      {import.meta.env.DEV ? (
        <>
          <button onClick={() => void devLogin()} style={{ padding: '0.6rem 1.5rem' }}>
            Đăng nhập thử (token giả, chỉ khi dev)
          </button>
          <p style={{ color: 'var(--fg-subdued)', fontSize: '0.85rem' }}>
            Trang tạm để thử luồng trên mock Prism. Đăng nhập và tạo tài khoản Cognito thật do An
            làm.
          </p>
        </>
      ) : (
        <p style={{ color: 'var(--fg-subdued)' }}>Tính năng đăng nhập đang được hoàn thiện.</p>
      )}
    </div>
  );
}
