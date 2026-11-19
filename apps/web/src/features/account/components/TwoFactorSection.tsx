import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { queryKeys } from '../../../shared/api/queryKeys';
import { setTwoFactorEnabled } from '../../../shared/auth/token';
import { Badge } from '../../../shared/components/Badge';
import { Button } from '../../../shared/components/Button';
import { ConfirmDialog } from '../../../shared/components/ConfirmDialog';
import { buttonClass } from '../../../shared/components/buttonClass';
import { toTwoFactorError } from '../../auth/lib/authErrors';
import { useSignOut } from '../lib/useSignOut';
import { useTwoFactorStatus } from '../lib/useTwoFactorStatus';
import styles from './TwoFactorSection.module.css';

export interface SectionNotice {
  tone: 'success' | 'danger';
  text: string;
}

interface TwoFactorSectionProps {
  /** Email của tài khoản: key của trạng thái (useTwoFactorStatus) */
  email: string | undefined;
  /** Báo kết quả tắt ở chỗ Alert đầu trang (pages/tai-khoan.md 3.1) */
  onNotice: (notice: SectionNotice) => void;
}

/**
 * Phần "Xác thực hai lớp" ở `/account` (pages/tai-khoan.md 3.1, 3.5; account.md BR-10): nhãn bật, tắt;
 * đang tắt thì link sang trang bật, đang bật thì nút "Tắt" mở hộp thoại hỏi lại.
 */
export function TwoFactorSection({ email, onNotice }: TwoFactorSectionProps) {
  const status = useTwoFactorStatus(email);
  const queryClient = useQueryClient();
  const signOutAndLeave = useSignOut();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const enableRef = useRef<HTMLAnchorElement>(null);

  const disable = async () => {
    setBusy(true);
    try {
      await setTwoFactorEnabled(false);
    } catch (error) {
      setBusy(false);
      setConfirming(false);
      const view = toTwoFactorError(error);
      if (view.target === 'session') {
        // Phiên hết: đăng xuất máy này rồi sang /login, xong quay lại trang tài khoản
        await signOutAndLeave({ to: '/login', state: { from: '/account' } });
        return;
      }
      onNotice({ tone: 'danger', text: view.message });
      return;
    }
    queryClient.setQueryData(queryKeys.account.twoFactor(email ?? ''), false);
    setBusy(false);
    setConfirming(false);
    onNotice({ tone: 'success', text: 'Đã tắt xác thực hai lớp.' });
    // Nút "Tắt" vừa biến mất: focus về link "Bật" thay chỗ nó (tai-khoan.md 3.5)
    requestAnimationFrame(() => enableRef.current?.focus());
  };

  const enabled = status.data;
  const text = status.isError
    ? 'Không tải được trạng thái, vui lòng tải lại trang.'
    : enabled === undefined
      ? 'Đang kiểm tra…'
      : enabled
        ? 'Đăng nhập cần mã 6 số từ ứng dụng xác thực.'
        : 'Nhập thêm mã 6 số từ ứng dụng xác thực mỗi lần đăng nhập.';

  return (
    <div className={styles.section}>
      <div>
        <div className={styles.heading}>
          <h2 className={styles.title}>Xác thực hai lớp</h2>
          {enabled !== undefined && (
            <Badge tone={enabled ? 'success' : 'neutral'}>
              {enabled ? 'Đang bật' : 'Đang tắt'}
            </Badge>
          )}
        </div>
        <p className={styles.text}>{text}</p>
      </div>
      {enabled === false && (
        <Link
          ref={enableRef}
          to="/account/two-factor"
          className={`${buttonClass({ variant: 'secondary', size: 'md' })} ${styles.action}`}
        >
          <ShieldCheck size={18} aria-hidden="true" />
          Bật
        </Link>
      )}
      {enabled === true && (
        <Button size="md" className={styles.action} onClick={() => setConfirming(true)}>
          Tắt
        </Button>
      )}
      {confirming && (
        <ConfirmDialog
          title="Tắt xác thực hai lớp?"
          confirmLabel="Tắt"
          cancelLabel="Giữ bật"
          busyLabel="Đang tắt…"
          tone="danger"
          busy={busy}
          onConfirm={() => void disable()}
          onClose={() => setConfirming(false)}
        >
          Đăng nhập sẽ chỉ cần email và mật khẩu. Tài khoản dễ bị chiếm hơn nếu lộ mật khẩu.
        </ConfirmDialog>
      )}
    </div>
  );
}
