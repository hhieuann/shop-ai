import { useRef, useState, type FormEvent } from 'react';
import { KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import { refreshProfile } from '../../../shared/auth/token';
import { Alert } from '../../../shared/components/Alert';
import { Button } from '../../../shared/components/Button';
import { Field } from '../../../shared/components/Field';
import { buttonClass } from '../../../shared/components/buttonClass';
import { USERNAME_PATTERN } from '../../auth/lib/validation';
import { updateUsername } from '../api/updateUsername';
import { AccountPanel } from '../components/AccountPanel';
import { useAccountOutlet } from '../lib/accountOutlet';
import { useSignOut } from '../lib/useSignOut';
import styles from './AccountInfoPage.module.css';

const REQUIRED = 'Vui lòng nhập username.';
const INVALID = 'Username chưa đúng quy tắc bên dưới.';
const TAKEN = 'Username này đã có người dùng.';
const HINT = '3–20 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới.';

interface Notice {
  tone: 'success' | 'danger';
  text: string;
}

/**
 * Thông tin tài khoản `/account` (pages/tai-khoan.md 3.1, mục 4; account.md BR-06): đổi username bằng
 * nút "Cập nhật" (PATCH /api/v1/me), email chỉ xem.
 */
export function AccountInfoPage() {
  const { user } = useAccountOutlet();
  const signOutAndLeave = useSignOut();
  const profileName = user?.username ?? '';

  // saved: username đang dùng (so với ô để bật nút). seen: tên hồ sơ lần trước, để biết khi nào hồ sơ đổi
  const [value, setValue] = useState(profileName);
  const [saved, setSaved] = useState(profileName);
  const [seen, setSeen] = useState(profileName);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Hồ sơ đổi từ nơi khác (đăng nhập tài khoản khác, làm mới phiên): ô lấy tên mới nếu khách chưa sửa ô
  if (profileName !== seen) {
    setSeen(profileName);
    setSaved(profileName);
    if (value === saved) setValue(profileName);
  }

  const focusInput = () =>
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLInputElement>('input[name="username"]')?.focus(),
    );
  const focusAlert = () => requestAnimationFrame(() => alertRef.current?.focus());

  const empty = value === '';
  const unchanged = value === saved;
  // Ô trống thì báo ngay, không chờ bấm nút (tai-khoan.md 3.1)
  const fieldError = empty ? REQUIRED : error;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || empty || unchanged) return;
    setNotice(null);
    if (!USERNAME_PATTERN.test(value)) {
      setError(INVALID);
      focusInput();
      return;
    }

    setBusy(true);
    let newName: string;
    try {
      newName = (await updateUsername(value)).username;
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.status === 401) {
        // Phiên hết: đăng xuất máy này rồi sang /login, xong quay lại trang tài khoản
        await signOutAndLeave({ to: '/login', state: { from: '/account' } });
        return;
      }
      if (err instanceof ApiError && err.status === 409 && err.code === 'USERNAME_TAKEN') {
        setError(TAKEN);
        focusInput();
      } else if (err instanceof ApiError && err.status === 400 && err.code === 'USERNAME_INVALID') {
        setError(INVALID);
        focusInput();
      } else if (
        err instanceof ApiError &&
        err.status === 400 &&
        err.code === 'USERNAME_REQUIRED'
      ) {
        setError(REQUIRED);
        focusInput();
      } else if (err instanceof ApiError && err.status === 400) {
        setNotice({ tone: 'danger', text: 'Không cập nhật được username, vui lòng thử lại.' });
        focusAlert();
      } else {
        setNotice({ tone: 'danger', text: 'Không kết nối được máy chủ, vui lòng thử lại.' });
        focusAlert();
      }
      return;
    }

    // Đã đổi trên server: tên mới thành tên đang dùng, nút về tím nhạt ngay, báo thành công
    setBusy(false);
    setSaved(newName);
    setValue(newName);
    setNotice({ tone: 'success', text: 'Đã cập nhật username.' });
    focusInput();
    try {
      await refreshProfile({ username: newName });
    } catch {
      // Làm mới phiên lỗi (mạng) không làm hỏng việc đã đổi: header, cột trái đổi tên ở lần làm mới
      // phiên sau, không báo lỗi
    }
  };

  return (
    <AccountPanel
      title="Thông tin tài khoản"
      subtitle="Username là tên hiện trên header. Email dùng để đăng nhập."
    >
      {notice && (
        <div className={styles.notice}>
          <Alert ref={alertRef} tone={notice.tone}>
            {notice.text}
          </Alert>
        </div>
      )}
      <form ref={formRef} noValidate onSubmit={(e) => void submit(e)}>
        <div className={styles.fields}>
          <Field
            label="Username"
            name="username"
            size="lg"
            className={styles.username}
            autoComplete="nickname"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={20}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
              setNotice(null);
            }}
            readOnly={busy}
            error={fieldError ?? undefined}
            hint={HINT}
            keepHint
          />
          <Field
            label="Email"
            size="lg"
            type="email"
            appearance="readonly"
            autoComplete="email"
            value={user?.email ?? ''}
          />
        </div>
        <div className={styles.actions}>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className={styles.update}
            busy={busy}
            disabled={empty || unchanged}
          >
            {busy ? 'Đang cập nhật…' : 'Cập nhật'}
          </Button>
        </div>
      </form>

      <div className={styles.password}>
        <div>
          <h2 className={styles.passwordTitle}>Mật khẩu</h2>
          <p className={styles.passwordText}>Nên đổi khi nghi người khác biết mật khẩu của bạn.</p>
        </div>
        <Link
          to="/account/password"
          className={`${buttonClass({ variant: 'secondary', size: 'md' })} ${styles.passwordLink}`}
        >
          <KeyRound size={18} aria-hidden="true" />
          Đổi mật khẩu
        </Link>
      </div>
    </AccountPanel>
  );
}
