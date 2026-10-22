import { useState, type FormEvent, type ReactNode } from 'react';
import { Field } from '../../../shared/components/Field';
import { toAuthError } from '../lib/authErrors';
import { AuthCard } from './AuthCard';
import styles from './AuthCard.module.css';

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

/** Bước nhập mã 6 số: xác nhận email (dang-nhap.md §3.3) và xác thực hai lớp (§3.1) */
export function CodeStep({ title, subtitle, onSubmit, onResend, alert }: CodeStepProps) {
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setNotice(null);
    if (!/^\d{6}$/.test(code)) {
      setCodeError('Nhập đủ 6 số trong email.');
      return;
    }
    setBusy(true);
    setCodeError(undefined);
    setFormError(null);
    try {
      await onSubmit(code);
    } catch (error) {
      const view = toAuthError(error);
      if (view.target === 'code') setCodeError(view.message);
      else setFormError(view.message);
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!onResend) return;
    setResending(true);
    setNotice(null);
    setFormError(null);
    try {
      await onResend();
      setNotice('Đã gửi mã mới.');
    } catch (error) {
      setFormError(toAuthError(error).message);
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthCard title={title} subtitle={subtitle} alert={formError ?? alert} notice={notice}>
      <form onSubmit={(e) => void submit(e)} noValidate className={styles.body}>
        <Field
          label={onResend ? 'Mã xác nhận' : 'Mã xác thực'}
          size="lg"
          className={styles.codeInput}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          readOnly={busy}
          error={codeError}
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
