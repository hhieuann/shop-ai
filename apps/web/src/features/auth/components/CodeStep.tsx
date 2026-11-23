import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { OtpInput } from '../../../shared/components/OtpInput';
import { toAuthError } from '../lib/authErrors';
import { AuthCard } from './AuthCard';
import styles from './AuthCard.module.css';

const CODE_LENGTH = 6;

interface CodeStepProps {
  title: string;
  subtitle: ReactNode;
  /** Gửi mã; lỗi ném ra sẽ hiện dưới ô mã hoặc đầu form */
  onSubmit: (code: string) => Promise<void>;
  /** Có thì hiện nút "Gửi lại mã" (bước xác nhận email; MFA không có) */
  onResend?: () => Promise<void>;
  /** Lỗi chung truyền từ trang (vd. tự gửi lại mã thất bại) */
  alert?: string | null;
}

/**
 * Bước nhập mã 6 số: xác nhận email (dang-nhap.md §3.3) và xác thực hai lớp (§3.1).
 * Gõ đủ 6 số thì tự gửi; nút "Xác nhận" vẫn giữ cho Enter, trình đọc màn hình và gửi lại sau lỗi mạng.
 */
export function CodeStep({ title, subtitle, onSubmit, onResend, alert }: CodeStepProps) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Chặn gửi trùng: tự gửi khi đủ số và Enter có thể tới gần nhau, trước khi state busy kịp đổi
  const sendingRef = useRef(false);

  const send = async (value: string) => {
    if (sendingRef.current) return;
    setNotice(null);
    if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(value)) {
      setCodeError(
        onResend ? 'Nhập đủ 6 số trong email.' : 'Nhập đủ 6 số trong ứng dụng xác thực.',
      );
      return;
    }
    sendingRef.current = true;
    setBusy(true);
    setCodeError(undefined);
    setFormError(null);
    try {
      await onSubmit(value);
    } catch (error) {
      const view = toAuthError(error);
      if (view.target === 'code') {
        // Mã sai, hết hạn: xoá số đã gõ (con trỏ luôn ở cuối nên giữ số thì không gõ tiếp được)
        setCode('');
        setCodeError(view.message);
        inputRef.current?.focus();
      } else {
        setFormError(view.message);
      }
    } finally {
      sendingRef.current = false;
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(code);
  };

  const resend = async () => {
    if (!onResend) return;
    setResending(true);
    setNotice(null);
    setFormError(null);
    try {
      await onResend();
      setNotice('Đã gửi mã mới.');
      setCode('');
      setCodeError(undefined);
      inputRef.current?.focus();
    } catch (error) {
      setFormError(toAuthError(error).message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard title={title} subtitle={subtitle} alert={formError ?? alert} notice={notice}>
      <form onSubmit={submit} noValidate className={styles.body}>
        <OtpInput
          label={onResend ? 'Mã xác nhận' : 'Mã xác thực'}
          length={CODE_LENGTH}
          value={code}
          onChange={(value) => {
            setCode(value);
            if (codeError) setCodeError(undefined);
          }}
          onComplete={(value) => void send(value)}
          readOnly={busy}
          error={codeError}
          autoFocus
          inputRef={inputRef}
        />
        <button type="submit" className={styles.primary} aria-busy={busy} disabled={busy}>
          {busy ? 'Đang xác nhận…' : 'Xác nhận'}
        </button>
        {onResend && (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => void resend()}
            disabled={resending}
          >
            {resending ? 'Đang gửi…' : 'Gửi lại mã'}
          </button>
        )}
      </form>
    </AuthCard>
  );
}
