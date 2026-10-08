import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Circle, CircleCheck } from 'lucide-react';
import { autoSignIn, confirmSignUp, resendSignUpCode, signUp } from 'aws-amplify/auth';
import { Field } from '../../../shared/components/Field';
import { PasswordField } from '../../../shared/components/PasswordField';
import { initAuth } from '../../../shared/auth/cognito';
import { getAccessToken } from '../../../shared/auth/token';
import { AuthCard } from '../components/AuthCard';
import styles from '../components/AuthCard.module.css';
import { CodeStep } from '../components/CodeStep';
import { toAuthError } from '../lib/authErrors';
import { useAuthNavigation } from '../lib/useAuthNavigation';
import {
  EMAIL_PATTERN,
  passwordMeetsPolicy,
  PASSWORD_RULES,
  USERNAME_PATTERN,
} from '../lib/validation';

type Errors = Partial<Record<'username' | 'email' | 'password' | 'confirm', string>>;

/**
 * Tạo tài khoản (dang-nhap.md §3.2) rồi nhập mã xác nhận gửi email (§3.3).
 * Xác nhận xong thì đăng nhập luôn (autoSignIn), khách không phải gõ lại. F5 ở bước 2 thì về bước 1.
 */
export function RegisterPage() {
  const navigate = useNavigate();
  const { state, from, reasonIsCheckout, finish } = useAuthNavigation();
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void initAuth();
    void getAccessToken().then((token) => {
      if (token) navigate(from, { replace: true });
    });
  }, [from, navigate]);

  const validate = (): Errors => {
    const next: Errors = {};
    if (!username) next.username = 'Vui lòng nhập username';
    else if (!USERNAME_PATTERN.test(username)) {
      next.username = 'Username chỉ gồm chữ thường không dấu, số, dấu chấm, gạch dưới.';
    }
    if (!email.trim()) next.email = 'Vui lòng nhập email';
    else if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Email không hợp lệ';
    if (!passwordMeetsPolicy(password)) next.password = 'Mật khẩu chưa đạt điều kiện bên dưới.';
    if (confirm !== password) next.confirm = 'Mật khẩu nhập lại không khớp.';
    return next;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next = validate();
    setErrors(next);
    setAlert(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await initAuth();
      const { nextStep } = await signUp({
        username: email.trim(),
        password,
        options: {
          userAttributes: { email: email.trim(), preferred_username: username },
          autoSignIn: true,
        },
      });
      if (nextStep.signUpStep === 'DONE') await finish();
      else setStep('confirm');
    } catch (error) {
      const view = toAuthError(error);
      if (view.target === 'alert' || view.target === 'code') setAlert(view.message);
      else setErrors({ [view.target]: view.message } as Errors);
    } finally {
      setBusy(false);
    }
  };

  if (step === 'confirm') {
    return (
      <CodeStep
        title="Xác nhận email"
        subtitle={
          <>
            Nhập mã 6 số vừa gửi tới <span className={styles.emphasis}>{email.trim()}</span>.
          </>
        }
        onResend={async () => {
          await resendSignUpCode({ username: email.trim() });
        }}
        onSubmit={async (code) => {
          const { nextStep } = await confirmSignUp({
            username: email.trim(),
            confirmationCode: code,
          });
          if (nextStep.signUpStep === 'COMPLETE_AUTO_SIGN_IN') await autoSignIn();
          await finish();
        }}
      />
    );
  }

  return (
    <AuthCard
      title="Tạo tài khoản"
      subtitle={
        reasonIsCheckout
          ? 'Đăng nhập hoặc tạo tài khoản để đặt hàng. Các sản phẩm bạn đã chọn được giữ nguyên.'
          : 'Mua hàng nhanh hơn và theo dõi đơn của bạn.'
      }
      alert={alert}
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" state={state}>
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={(e) => void submit(e)} noValidate className={styles.body}>
        <Field
          label="Username"
          size="lg"
          autoComplete="nickname"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          readOnly={busy}
          hint="Tên hiện trên header khi bạn đăng nhập."
          error={errors.username}
        />
        <Field
          label="Email"
          size="lg"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={busy}
          error={errors.email}
        />
        {errors.email === 'Email này đã có tài khoản.' && (
          // Kèm lối sang đăng nhập (dang-nhap.md §4)
          <Link to="/login" state={state} className={styles.inlineLink}>
            Đăng nhập bằng email này
          </Link>
        )}
        <PasswordField
          label="Mật khẩu"
          size="lg"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          readOnly={busy}
          error={errors.password}
          // Field tự nối dòng lỗi; chưa có lỗi thì nối danh sách điều kiện (dang-nhap.md §3.2)
          aria-describedby={errors.password ? undefined : 'password-rules'}
        >
          <ul id="password-rules" className={styles.rules}>
            {PASSWORD_RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <li key={rule.id} className={met ? styles.met : undefined}>
                  {met ? (
                    <CircleCheck size={16} aria-hidden="true" />
                  ) : (
                    <Circle size={16} aria-hidden="true" />
                  )}
                  {rule.label}
                  <span className="sr-only">{met ? ' (đã đạt)' : ' (chưa đạt)'}</span>
                </li>
              );
            })}
          </ul>
        </PasswordField>
        <PasswordField
          label="Nhập lại mật khẩu"
          size="lg"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          readOnly={busy}
          error={errors.confirm}
        />
        <button type="submit" className={styles.primary} aria-busy={busy} disabled={busy}>
          {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
        </button>
      </form>
    </AuthCard>
  );
}
