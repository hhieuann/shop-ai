import { useId, useState, type CSSProperties, type Ref, type SyntheticEvent } from 'react';
import { CircleAlert } from 'lucide-react';
import styles from './OtpInput.module.css';

interface OtpInputProps {
  label: string;
  /** Các số đã gõ (chỉ chữ số, dài tối đa `length`) */
  value: string;
  onChange: (value: string) => void;
  /** Gọi một lần mỗi khi số đã gõ vừa đủ `length` (vd. tự gửi mã) */
  onComplete?: (value: string) => void;
  /** Số ô, mặc định 6 */
  length?: number;
  error?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  inputRef?: Ref<HTMLInputElement>;
}

/** Giữ con trỏ ở cuối: không sửa số ở giữa, muốn sửa thì xoá lùi */
function caretToEnd(event: SyntheticEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const end = input.value.length;
  if (input.selectionStart !== end || input.selectionEnd !== end) {
    input.setSelectionRange(end, end);
  }
}

/**
 * Ô nhập mã số độ dài cố định vẽ thành từng ô (design-system §9.4 "Ô mã"). Bên dưới là MỘT ô nhập
 * thật trong suốt phủ kín các ô, nên dán mã, tự điền mã (`one-time-code`), nhãn, lỗi và trình đọc
 * màn hình chạy như ô nhập thường; các ô vẽ là `aria-hidden`.
 *
 * Không đặt `maxLength`: trình duyệt cắt chữ dán theo `maxLength` trước khi lọc số, nên dán
 * "123 456" sẽ mất số. Ô tự lọc số rồi cắt còn `length` trong `onChange`.
 */
export function OtpInput({
  label,
  value,
  onChange,
  onComplete,
  length = 6,
  error,
  readOnly = false,
  autoFocus,
  inputRef,
}: OtpInputProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [focused, setFocused] = useState(false);
  // Ô đang sáng: ô trống đầu tiên, đủ số thì ô cuối; chỉ khi đang focus và gõ được
  const activeIndex = focused && !readOnly ? Math.min(value.length, length - 1) : -1;

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <div
        className={`${styles.boxes} ${readOnly ? styles.readOnly : ''}`}
        style={{ '--otp-length': length } as CSSProperties}
      >
        {Array.from({ length }, (_, index) => {
          const digit = value[index];
          const className = [
            styles.box,
            digit ? styles.filled : '',
            error ? styles.invalid : '',
            index === activeIndex ? styles.active : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div key={index} className={className} aria-hidden="true">
              {digit ?? (index === activeIndex && <span className={styles.caret} />)}
            </div>
          );
        })}
        <input
          id={id}
          ref={inputRef}
          className={styles.input}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value={value}
          readOnly={readOnly}
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            const next = event.target.value.replace(/\D/g, '').slice(0, length);
            onChange(next);
            if (next.length === length && value.length < length) onComplete?.(next);
          }}
          onFocus={(event) => {
            setFocused(true);
            caretToEnd(event);
          }}
          onBlur={() => setFocused(false)}
          onClick={caretToEnd}
          onSelect={caretToEnd}
        />
      </div>
      {error && (
        <p id={errorId} className={styles.error}>
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
