import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { confirmResetPassword, resetPassword } from 'aws-amplify/auth';
import { Alert } from '../../../shared/components/Alert';
import { Field } from '../../../shared/components/Field';
import { OtpInput } from '../../../shared/components/OtpInput';
import { PasswordField } from '../../../shared/components/PasswordField';
import { authMode, initAuth } from '../../../shared/auth/cognito';
import { getAccessToken } from '../../../shared/auth/token';
import { AuthCard } from '../components/AuthCard';
import styles from '../components/AuthCard.module.css';
import { PasswordRules } from '../components/PasswordRules';
import { toResetPasswordError } from '../lib/authErrors';
import { useAuthNavigation } from '../lib/useAuthNavigation';
import { EMAIL_PATTERN, passwordMeetsPolicy } from '../lib/validation';

const CODE_LENGTH = 6;

type Errors = Partial<Record<'email' | 'code' | 'password' | 'confirm', string>>;

/**
 * Quên mật khẩu (dang-nhap.md §3.4, account.md BR-13): bước 1 nhập email, Cognito gửi mã; bước 2 nhập
 * mã và mật khẩu mới. Không cho biết email có tài khoản hay không: email nào cũng sang bước 2 với cùng
 * câu chữ. Xong thì về /login điền sẵn email, không tự đăng nhập (MFA, xác nhận email đi luồng §3.1).
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const { state, from, email: initialEmail } = useAuthNavigation();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState(initialEmail ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [mode, setMode] = useState(authMode());
  const codeRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    void initAuth().then(setMode);
    // Đã đăng nhập thì không cần đặt lại mật khẩu: về trang trước (§1)
    void getAccessToken().then((token) => {
      if (token) navigate(from, { replace: true });
    });
  }, [from, navigate]);

  const trimmedEmail = email.trim();

  const sendCode = async (e: FormEvent) => {
    e.preventDefault();
    setAlert(null);
    if (!trimmedEmail) return setErrors({ email: 'Vui lòng nhập email' });
    if (!EMAIL_PATTERN.test(trimmedEmail)) return setErrors({ email: 'Email không hợp lệ' });
    setErrors({});
    setBusy(true);
    try {
      await initAuth();
      await resetPassword({ username: trimmedEmail });
      setCode('');
      setNotice(null);
      setStep('reset');
    } catch (error) {
      const view = toResetPasswordError(error);
      if (view.target === 'email') setErrors({ email: view.message });
      else setAlert(view.message);
    } finally {
      setBusy(false);
    }
  };

  /** Mã sai, hết hạn: xoá mã (con trỏ ô mã luôn ở cuối), giữ mật khẩu đã gõ */
  const rejectCode = (message: string) => {
    setCode('');
    setErrors({ code: message });
    codeRef.current?.focus();
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setAlert(null);
    setNotice(null);
    const next: Errors = {};
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) next.code = 'Nhập đủ 6 số trong email.';
    if (!passwordMeetsPolicy(password)) next.password = 'Mật khẩu chưa đạt điều kiện bên dưới.';
    if (confirm !== password) next.confirm = 'Mật khẩu nhập lại không khớp.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await confirmResetPassword({
        username: trimmedEmail,
        confirmationCode: code,
        newPassword: password,
      });
      navigate('/login', {
        replace: true,
        state: {
          ...state,
          email: trimmedEmail,
          notice: 'Đã đặt mật khẩu mới. Đăng nhập bằng mật khẩu mới.',
        },
      });
    } catch (error) {
      const view = toResetPasswordError(error);
      if (view.target === 'code') rejectCode(view.message);
      else if (view.target === 'password') setErrors({ password: view.message });
      else setAlert(view.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setResending(true);
    setAlert(null);
    setNotice(null);
    try {
      await resetPassword({ username: trimmedEmail });
      setNotice('Đã gửi mã mới.');
      setCode('');
      setErrors((current) => ({ ...current, code: undefined }));
      codeRef.current?.focus();
    } catch (error) {
      setAlert(toResetPasswordError(error).message);
    } finally {
      setResending(false);
    }
  };

  // Chạy trên mock (không có /config.json) thì không có Cognito để gửi mã: báo rõ, không giả luồng
  const mockNotice = mode === 'dev' && import.meta.env.DEV && (
    <Alert tone="warning">
      Đang chạy trên mock, không có Cognito: chỉ xem được giao diện, không gửi được mã.
    </Alert>
  );

  if (step === 'reset') {
    return (
      <AuthCard
        title="Đặt mật khẩu mới"
        subtitle={
          <>
            Nếu <span className={styles.emphasis}>{trimmedEmail}</span> có tài khoản, mã 6 số đã
            được gửi tới email này. Xem cả mục thư rác.
          </>
        }
        alert={alert}
        notice={notice}
        footer={
          <>
            Sai email?{' '}
            <button
              type="button"
              className={styles.footerLink}
              onClick={() => {
                setStep('email');
                setErrors({});
                setAlert(null);
                setNotice(null);
              }}
            >
              Nhập lại email
            </button>
          </>
        }
      >
        <form ref={formRef} onSubmit={(e) => void reset(e)} noValidate className={styles.body}>
          {mockNotice}
          <OtpInput
            label="Mã xác nhận"
            length={CODE_LENGTH}
            value={code}
            onChange={(value) => {
              setCode(value);
              if (errors.code) setErrors((current) => ({ ...current, code: undefined }));
            }}
            // Không tự gửi: Cognito chỉ kiểm mã cùng lúc với mật khẩu mới (§3.4)
            onComplete={() =>
              formRef.current
                ?.querySelector<HTMLInputElement>('input[autocomplete="new-password"]')
                ?.focus()
            }
            readOnly={busy}
            error={errors.code}
            inputRef={codeRef}
          />
          <PasswordField
            label="Mật khẩu mới"
            size="lg"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            readOnly={busy}
            error={errors.password}
            aria-describedby={errors.password ? undefined : 'new-password-rules'}
          >
            <PasswordRules id="new-password-rules" password={password} />
          </PasswordField>
          <PasswordField
            label="Nhập lại mật khẩu mới"
            size="lg"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            readOnly={busy}
            error={errors.confirm}
          />
          <button type="submit" className={styles.primary} aria-busy={busy} disabled={busy}>
            {busy ? 'Đang lưu…' : 'Đặt lại mật khẩu'}
          </button>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => void resend()}
            disabled={resending}
          >
            {resending ? 'Đang gửi…' : 'Gửi lại mã'}
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Đặt lại mật khẩu"
      subtitle="Nhập email của tài khoản. Chúng tôi sẽ gửi mã 6 số để bạn đặt mật khẩu mới."
      alert={alert}
      footer={
        <>
          Nhớ ra mật khẩu?{' '}
          <Link to="/login" state={{ ...state, email: trimmedEmail || undefined }}>
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void sendCode(e)} noValidate className={styles.body}>
        {mockNotice}
        <Field
          label="Email"
          size="lg"
          type="email"
          autoComplete="username"
          inputMode="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={busy}
          error={errors.email}
        />
        <button type="submit" className={styles.primary} aria-busy={busy} disabled={busy}>
          {busy ? 'Đang gửi…' : 'Gửi mã'}
        </button>
      </form>
    </AuthCard>
  );
}
