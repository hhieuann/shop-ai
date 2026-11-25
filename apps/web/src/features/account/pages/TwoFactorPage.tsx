import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { queryKeys } from '../../../shared/api/queryKeys';
import {
  setTwoFactorEnabled,
  setUpTwoFactor,
  verifyTwoFactorCode,
} from '../../../shared/auth/token';
import { Alert } from '../../../shared/components/Alert';
import { Button } from '../../../shared/components/Button';
import { OtpInput } from '../../../shared/components/OtpInput';
import { buttonClass } from '../../../shared/components/buttonClass';
import { toTwoFactorError } from '../../auth/lib/authErrors';
import { AccountPanel } from '../components/AccountPanel';
import { useAccountOutlet } from '../lib/accountOutlet';
import { groupSecret, TOTP_ISSUER, totpUri } from '../lib/totp';
import { useSignOut } from '../lib/useSignOut';
import { useTwoFactorStatus } from '../lib/useTwoFactorStatus';
import styles from './TwoFactorPage.module.css';

const CODE_LENGTH = 6;
const ENABLED_NOTICE = 'Đã bật xác thực hai lớp. Lần đăng nhập sau cần mã 6 số.';

/** state khi trang admin chuyển sang (admin-don-hang.md mục 1) */
interface TwoFactorState {
  from?: string;
  reason?: string;
}

/** Ảnh QR (data URL) từ thư viện `qrcode`, chỉ nạp ở trang này (import động) */
function useQrImage(uri: string | null): string | null {
  const [image, setImage] = useState<{ uri: string; src: string } | null>(null);
  useEffect(() => {
    if (!uri) return;
    let cancelled = false;
    void import('qrcode')
      // Ảnh 2 lần cỡ hiển thị (150px) cho nét trên màn hình mật độ cao; viền trắng do ô QR lo
      .then(({ toDataURL }) => toDataURL(uri, { margin: 0, width: 300 }))
      .then((src) => {
        if (!cancelled) setImage({ uri, src });
      })
      .catch(() => {
        // Không vẽ được QR: khách vẫn dùng mã chữ và link mở ứng dụng
      });
    return () => {
      cancelled = true;
    };
  }, [uri]);
  return image && image.uri === uri ? image.src : null;
}

/**
 * Bật xác thực hai lớp `/account/two-factor` (pages/tai-khoan.md 3.4, mục 4; account.md BR-10): thêm
 * tài khoản vào ứng dụng xác thực bằng mã QR hoặc mã chữ, rồi nhập mã 6 số để xác nhận. Mã chữ chỉ ở
 * bộ nhớ trang (threat model L13): không lưu, không ghi log, rời trang là mất.
 */
export function TwoFactorPage() {
  const { user } = useAccountOutlet();
  const email = user?.email;
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const signOutAndLeave = useSignOut();
  const { from, reason } = (location.state as TwoFactorState | null) ?? {};
  // Mọi trang quản trị (/admin, /admin/...) chuyển sang đây đều quay về đúng trang đó sau khi bật
  const fromAdmin = from !== undefined && /^\/admin(?:[/?]|$)/.test(from);

  const status = useTwoFactorStatus(email);
  // Chỉ tạo mã khi biết chắc chưa bật: AssociateSoftwareToken (setUpTOTP) gỡ ngay mã đang dùng, nên
  // đọc trạng thái lỗi mà vẫn tạo thì tài khoản đã bật mất ứng dụng xác thực hiện tại. Key riêng, xoá
  // khi rời trang (gcTime 0) để mã không nằm lại trong bộ nhớ đệm; một lần mở trang một mã, kể cả khi
  // React chạy effect hai lần
  const canSetUp = Boolean(email) && status.data === false;
  const setup = useQuery({
    queryKey: [...queryKeys.account.all, 'totp-setup', email ?? ''],
    queryFn: setUpTwoFactor,
    enabled: canSetUp,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const secret = setup.data ?? null;
  const uri = secret && email ? totpUri(secret, email) : null;
  const qr = useQrImage(uri);

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  // Mã đã xác nhận nhưng bước bật lỗi: lần sau chỉ bật, không xác nhận lại mã cũ
  const verifiedRef = useRef(false);
  const doneRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  // Đã bật rồi (mở lại trang, bật ở máy khác): về trang tài khoản. Vừa bật xong ở đây thì trang tự chuyển
  if (status.data === true && !doneRef.current) return <Navigate to="/account" replace />;

  const focusAlert = () => requestAnimationFrame(() => alertRef.current?.focus());

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
    } catch {
      // Trình duyệt chặn clipboard: mã chữ vẫn chọn và chép tay được
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !secret) return;
    setAlert(null);
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
      setCodeError('Nhập đủ 6 số trong ứng dụng.');
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setCodeError(undefined);
    try {
      if (!verifiedRef.current) {
        await verifyTwoFactorCode(code);
        verifiedRef.current = true;
      }
      await setTwoFactorEnabled(true);
    } catch (error) {
      setBusy(false);
      const view = toTwoFactorError(error);
      if (view.target === 'session') {
        await signOutAndLeave({ to: '/login', state: { from: location.pathname } });
      } else if (view.target === 'code') {
        // Xoá 6 số, focus ô đầu (con trỏ luôn ở cuối nên giữ số thì không gõ tiếp được)
        setCode('');
        setCodeError(view.message);
        inputRef.current?.focus();
      } else {
        setAlert(view.message);
        focusAlert();
      }
      return;
    }
    doneRef.current = true;
    queryClient.setQueryData(queryKeys.account.twoFactor(email ?? ''), true);
    if (fromAdmin && from) navigate(from, { replace: true });
    else navigate('/account', { replace: true, state: { notice: ENABLED_NOTICE } });
  };

  const loading = !secret;

  return (
    <AccountPanel
      title="Bật xác thực hai lớp"
      subtitle="Mỗi lần đăng nhập, bạn sẽ nhập thêm mã 6 số từ ứng dụng xác thực."
    >
      {reason === 'admin' && (
        <div className={styles.notice}>
          <Alert tone="warning">Tài khoản quản trị cần bật xác thực hai lớp.</Alert>
        </div>
      )}
      {status.isError && (
        <div className={styles.notice}>
          <Alert
            tone="danger"
            action={
              <Button size="sm" busy={status.isFetching} onClick={() => void status.refetch()}>
                Thử lại
              </Button>
            }
          >
            Không tải được trạng thái xác thực hai lớp, vui lòng thử lại.
          </Alert>
        </div>
      )}
      {setup.isError && (
        <div className={styles.notice}>
          <Alert
            tone="danger"
            action={
              <Button size="sm" busy={setup.isFetching} onClick={() => void setup.refetch()}>
                Thử lại
              </Button>
            }
          >
            Không tạo được mã, vui lòng thử lại.
          </Alert>
        </div>
      )}
      {alert && (
        <div className={styles.notice}>
          <Alert ref={alertRef} tone="danger">
            {alert}
          </Alert>
        </div>
      )}

      <section aria-labelledby="two-factor-step-1">
        <h2 id="two-factor-step-1" className={styles.step}>
          1. Thêm tài khoản vào ứng dụng xác thực
        </h2>
        <div className={styles.setup}>
          <div className={styles.qr} aria-busy={!qr || undefined}>
            {qr && (
              <img
                src={qr}
                width={150}
                height={150}
                alt={`Mã QR để thêm tài khoản ${TOTP_ISSUER} vào ứng dụng xác thực`}
              />
            )}
          </div>
          <div className={styles.guide}>
            <p className={styles.lead}>Mở ứng dụng xác thực trên điện thoại và quét mã này.</p>
            <p className={styles.help}>
              Không có điện thoại? Dùng ứng dụng xác thực trên máy tính (tiện ích trình duyệt, trình
              quản lý mật khẩu như Bitwarden, 1Password, KeePassXC) và nhập mã chữ dưới đây.
            </p>
            <div className={styles.secretRow}>
              {loading ? (
                <span className={`${styles.secret} ${styles.secretLoading}`} aria-hidden="true" />
              ) : (
                <code className={styles.secret}>{groupSecret(secret)}</code>
              )}
              <Button
                variant="ghost"
                size="sm"
                className={styles.copy}
                disabled={loading}
                onClick={() => void copy()}
              >
                <Copy size={16} aria-hidden="true" />
                {copied ? 'Đã chép' : 'Chép mã'}
              </Button>
              <span className="sr-only" aria-live="polite">
                {copied ? 'Đã chép mã' : ''}
              </span>
            </div>
            {uri && (
              <a href={uri} className={styles.appLink}>
                Mở bằng ứng dụng trên máy này
              </a>
            )}
          </div>
        </div>
      </section>

      <form
        className={styles.verify}
        aria-labelledby="two-factor-step-2"
        noValidate
        onSubmit={(e) => void submit(e)}
      >
        <h2 id="two-factor-step-2" className={styles.step}>
          2. Nhập mã 6 số đang hiện trong ứng dụng
        </h2>
        <div className={styles.code}>
          {/* Không tự gửi khi đủ 6 số (An chốt 18/11): khách bấm nút hoặc Enter */}
          <OtpInput
            label="Mã xác thực"
            length={CODE_LENGTH}
            value={code}
            onChange={(value) => {
              setCode(value);
              if (codeError) setCodeError(undefined);
            }}
            readOnly={busy}
            error={codeError}
            inputRef={inputRef}
          />
        </div>
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className={styles.submit}
            busy={busy}
            disabled={loading}
          >
            {busy ? 'Đang bật…' : 'Bật xác thực hai lớp'}
          </Button>
          <Link
            to="/account"
            className={`${buttonClass({ variant: 'ghost', size: 'md' })} ${styles.later}`}
          >
            Để sau
          </Link>
        </div>
      </form>
    </AccountPanel>
  );
}
