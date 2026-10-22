import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { confirmSignIn, confirmSignUp, resendSignUpCode, signIn } from 'aws-amplify/auth';
import { Field } from '../../../shared/components/Field';
import { PasswordField } from '../../../shared/components/PasswordField';
import { authMode, initAuth } from '../../../shared/auth/cognito';
import { getAccessToken, signInWithDevToken } from '../../../shared/auth/token';
import { AuthCard } from '../components/AuthCard';
import styles from '../components/AuthCard.module.css';
import { CodeStep } from '../components/CodeStep';
import { toAuthError } from '../lib/authErrors';
import { useAuthNavigation } from '../lib/useAuthNavigation';
import { EMAIL_PATTERN } from '../lib/validation';

type Step = 'password' | 'mfa' | 'confirmEmail';

/** Đăng nhập (dang-nhap.md §3.1). Đăng nhập bằng email; username chỉ để hiển thị. */
export function LoginPage() {
  const navigate = useNavigate();
  const { state, from, reasonIsCheckout, finish } = useAuthNavigation();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  // Chỉ giữ trong bộ nhớ trang để đăng nhập lại ngay sau khi xác nhận email
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState(authMode());

  useEffect(() => {
    void initAuth().then(setMode);
    // Đã đăng nhập mà vào /login thì về lại trang trước (§1)
    void getAccessToken().then((token) => {
      if (token) navigate(from, { replace: true });
    });
  }, [from, navigate]);

  const handleNextStep = async (signInStep: string) => {
    if (signInStep === 'DONE') return finish();
    if (signInStep === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') return setStep('mfa');
    if (signInStep === 'CONFIRM_SIGN_UP') {
      // Tài khoản chưa xác nhận email: chuyển sang bước nhập mã và tự gửi lại mã (§4)
      setStep('confirmEmail');
      try {
        await resendSignUpCode({ username: email });
      } catch (error) {
        setAlert(toAuthError(error).message);
      }
      return;
    }
    setAlert('Tài khoản cần thêm bước xác thực chưa được hỗ trợ. Vui lòng liên hệ shop.');
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Vui lòng nhập email';
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Email không hợp lệ';
    if (!password) next.password = 'Vui lòng nhập mật khẩu';
    setErrors(next);
    setAlert(null);
    if (next.email || next.password) return;

    setBusy(true);
    try {
      await initAuth();
      const { nextStep } = await signIn({ username: email.trim(), password });
      await handleNextStep(nextStep.signInStep);
    } catch (error) {
      // Phiên cũ còn (vd. mở 2 tab): coi như đã đăng nhập
      if ((error as { name?: string }).name === 'UserAlreadyAuthenticatedException') {
        await finish();
        return;
      }
      const view = toAuthError(error);
      if (view.target === 'email' || view.target === 'password') {
        setErrors({ [view.target]: view.message });
      } else setAlert(view.message);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'mfa') {
    return (
      <CodeStep
        title="Xác thực hai lớp"
        subtitle="Nhập mã 6 số trong ứng dụng xác thực của bạn."
        onSubmit={async (code) => {
          const { nextStep } = await confirmSignIn({ challengeResponse: code });
          await handleNextStep(nextStep.signInStep);
        }}
      />
    );
  }

  if (step === 'confirmEmail') {
    return (
      <CodeStep
        title="Xác nhận email"
        subtitle={
          <>
            Nhập mã 6 số vừa gửi tới <span className={styles.emphasis}>{email}</span>.
          </>
        }
        alert={alert}
        onResend={async () => {
          await resendSignUpCode({ username: email });
        }}
        onSubmit={async (code) => {
          await confirmSignUp({ username: email, confirmationCode: code });
          const { nextStep } = await signIn({ username: email, password });
          setPassword('');
          await handleNextStep(nextStep.signInStep);
        }}
      />
    );
  }

  const devLogin = async () => {
    if (signInWithDevToken()) await finish();
  };

  return (
    <AuthCard
      title="Đăng nhập"
      subtitle={
        reasonIsCheckout
          ? 'Đăng nhập hoặc tạo tài khoản để đặt hàng. Các sản phẩm bạn đã chọn được giữ nguyên.'
          : 'Đăng nhập để dùng giỏ hàng và đặt hàng.'
      }
      alert={alert}
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" state={state}>
            Tạo tài khoản
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate className={styles.body}>
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
        <PasswordField
          label="Mật khẩu"
          size="lg"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          readOnly={busy}
          error={errors.password}
        />
        <button type="submit" className={styles.primary} aria-busy={busy} disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        {mode === 'dev' && import.meta.env.DEV && (
          <button type="button" className={styles.ghost} onClick={() => void devLogin()}>
            Đăng nhập thử (token giả, chỉ khi dev trên mock)
          </button>
        )}
      </form>
    </AuthCard>
  );
}
