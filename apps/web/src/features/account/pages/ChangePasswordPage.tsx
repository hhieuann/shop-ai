import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { changePassword } from '../../../shared/auth/token';
import { Alert } from '../../../shared/components/Alert';
import { Button } from '../../../shared/components/Button';
import { PasswordField } from '../../../shared/components/PasswordField';
import { PasswordRules } from '../../auth/components/PasswordRules';
import { toChangePasswordError } from '../../auth/lib/authErrors';
import { passwordMeetsPolicy } from '../../auth/lib/validation';
import { AccountPanel } from '../components/AccountPanel';
import { useAccountOutlet } from '../lib/accountOutlet';
import { useSignOut } from '../lib/useSignOut';
import styles from './ChangePasswordPage.module.css';

type FieldName = 'currentPassword' | 'newPassword' | 'confirmPassword';
type Errors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: readonly FieldName[] = ['currentPassword', 'newPassword', 'confirmPassword'];
const SIGN_OUT_FAILED = 'Đã đổi mật khẩu nhưng chưa đăng xuất được các thiết bị khác.';

/**
 * Đổi mật khẩu `/account/password` (pages/tai-khoan.md 3.2, mục 4; account.md BR-14).
 * Đổi xong thì đăng xuất mọi nơi, kể cả máy này, rồi sang /login kèm email và câu báo. Đăng xuất mọi
 * nơi lỗi thì giữ phiên máy này, báo và cho "Thử lại" (chỉ gọi lại đăng xuất mọi nơi).
 */
export function ChangePasswordPage() {
  const { user } = useAccountOutlet();
  const navigate = useNavigate();
  const signOutAndLeave = useSignOut();

  const [values, setValues] = useState<Record<FieldName, string>>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Errors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Mật khẩu đã đổi nhưng chưa đăng xuất được mọi nơi: form khoá, chỉ còn "Thử lại"
  const [changed, setChanged] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const focusField = (name: FieldName) =>
    // Chờ React vẽ xong (ô vừa đổi giá trị, dòng lỗi vừa hiện)
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus(),
    );
  const focusAlert = () => requestAnimationFrame(() => alertRef.current?.focus());

  const setValue = (name: FieldName, value: string) => {
    setValues((current) => ({ ...current, [name]: value }));
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
  };

  /** Đăng xuất mọi nơi rồi sang /login; lỗi thì ở lại trang, báo và cho thử lại */
  const leave = async () => {
    try {
      await signOutAndLeave({
        global: true,
        to: '/login',
        state: {
          email: user?.email,
          from: '/account',
          notice: 'Đã đổi mật khẩu. Đăng nhập bằng mật khẩu mới.',
        },
      });
    } catch {
      setChanged(true);
      setBusy(false);
      setRetrying(false);
      setAlert(SIGN_OUT_FAILED);
      focusAlert();
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || changed) return;
    setAlert(null);

    const next: Errors = {};
    if (!values.currentPassword) next.currentPassword = 'Vui lòng nhập mật khẩu hiện tại.';
    if (!values.newPassword) next.newPassword = 'Vui lòng nhập mật khẩu mới.';
    else if (!passwordMeetsPolicy(values.newPassword))
      next.newPassword = 'Mật khẩu chưa đạt điều kiện bên dưới.';
    if (values.confirmPassword !== values.newPassword)
      next.confirmPassword = 'Mật khẩu nhập lại không khớp.';
    setErrors(next);
    const firstError = FIELD_ORDER.find((name) => next[name]);
    if (firstError) return focusField(firstError);

    setBusy(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
    } catch (error) {
      setBusy(false);
      const view = toChangePasswordError(error);
      if (view.target === 'session') {
        // Phiên hết (vd. Cognito thu hồi access token) nhưng token có thể còn trên máy: đăng xuất máy này
        // trước, không thì /login thấy còn token và đẩy về lại trang này (dang-nhap.md §1)
        const state = { from: '/account/password' };
        try {
          await signOutAndLeave({ to: '/login', state });
        } catch {
          navigate('/login', { replace: true, state });
        }
      } else if (view.target === 'currentPassword') {
        // Xoá ô mật khẩu hiện tại, giữ hai ô mật khẩu mới (tai-khoan.md mục 4)
        setValues((current) => ({ ...current, currentPassword: '' }));
        setErrors({ currentPassword: view.message });
        focusField('currentPassword');
      } else if (view.target === 'password') {
        setErrors({ newPassword: view.message });
        focusField('newPassword');
      } else {
        setAlert(view.message);
        focusAlert();
      }
      return;
    }
    // Đổi xong: nút giữ "Đang đổi mật khẩu…" tới lúc chuyển trang
    await leave();
  };

  const retry = async () => {
    setRetrying(true);
    await leave();
  };

  const locked = busy || changed;

  return (
    <AccountPanel
      title="Đổi mật khẩu"
      subtitle="Đổi xong, mọi thiết bị đều đăng xuất, kể cả máy này. Đăng nhập lại bằng mật khẩu mới."
    >
      {alert && (
        <div className={styles.alert}>
          <Alert
            ref={alertRef}
            tone="danger"
            action={
              changed ? (
                <Button size="sm" busy={retrying} onClick={() => void retry()}>
                  {retrying ? 'Đang thử lại…' : 'Thử lại'}
                </Button>
              ) : undefined
            }
          >
            {alert}
          </Alert>
        </div>
      )}
      <form ref={formRef} className={styles.form} noValidate onSubmit={(e) => void submit(e)}>
        <div className={styles.current}>
          <PasswordField
            label="Mật khẩu hiện tại"
            name="currentPassword"
            size="lg"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(e) => setValue('currentPassword', e.target.value)}
            readOnly={locked}
            error={errors.currentPassword}
          />
          <Link to="/forgot-password" className={styles.forgot}>
            Quên mật khẩu hiện tại?
          </Link>
        </div>
        <PasswordField
          label="Mật khẩu mới"
          name="newPassword"
          size="lg"
          autoComplete="new-password"
          value={values.newPassword}
          onChange={(e) => setValue('newPassword', e.target.value)}
          readOnly={locked}
          error={errors.newPassword}
          aria-describedby={errors.newPassword ? undefined : 'change-password-rules'}
        >
          <PasswordRules id="change-password-rules" password={values.newPassword} />
        </PasswordField>
        <PasswordField
          label="Nhập lại mật khẩu mới"
          name="confirmPassword"
          size="lg"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={(e) => setValue('confirmPassword', e.target.value)}
          readOnly={locked}
          error={errors.confirmPassword}
        />
        {!changed && (
          <Button type="submit" variant="primary" size="lg" className={styles.submit} busy={busy}>
            {busy ? 'Đang đổi mật khẩu…' : 'Đổi mật khẩu'}
          </Button>
        )}
      </form>
    </AccountPanel>
  );
}
