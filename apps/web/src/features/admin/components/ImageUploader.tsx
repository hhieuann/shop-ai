import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { Field } from '../../../shared/components/Field';
import { LIMITS } from '../lib/productForm';
import {
  checkImageFile,
  IMAGE_ACCEPT,
  isUploadedImage,
  requestImageUpload,
  UPLOAD_FAILED,
  UploadAbortedError,
  uploadImageFile,
  type RunningUpload,
} from '../lib/productImage';
import { ImagePreview } from './ImagePreview';
import styles from './ImageUploader.module.css';

type Mode = 'upload' | 'link';
const MODES: readonly { value: Mode; label: string }[] = [
  { value: 'upload', label: 'Tải ảnh lên' },
  { value: 'link', label: 'Dán đường dẫn' },
];

interface Uploading {
  /** Ảnh xem trước lấy từ tệp trên máy (object URL), hiện mờ trong lúc tải */
  readonly preview: string | null;
  readonly percent: number;
}

/**
 * Khối Ảnh của form sản phẩm (pages/admin-san-pham.md mục 3, catalog.md BR-16). Hai cách:
 * - "Tải ảnh lên" (mặc định): chọn hoặc kéo thả tệp, kiểm loại và cỡ, xin vé rồi POST thẳng lên S3,
 *   xong thì điền `imageUrl` trả về;
 * - "Dán đường dẫn": ô https như trước. Trang sửa có ảnh https ngoài bucket ảnh thì mở sẵn cách này.
 * Nút X trong khung: đang tải thì huỷ lượt tải, đã có ảnh thì bỏ ảnh khỏi form (lưu gửi `imageUrl: null`).
 */
export function ImageUploader({
  value,
  onChange,
  urlError,
  disabled = false,
  onUploadingChange,
}: {
  value: string;
  onChange: (url: string) => void;
  /** Lỗi của ô đường dẫn (kiểm ở form hoặc 400 từ API) */
  urlError?: string;
  disabled?: boolean;
  /** Báo form để khoá "Lưu sản phẩm" khi ảnh chưa tải xong */
  onUploadingChange: (uploading: boolean) => void;
}) {
  const [mode, setMode] = useState<Mode>(() =>
    value.trim() !== '' && !isUploadedImage(value) ? 'link' : 'upload',
  );
  const [uploading, setUploading] = useState<Uploading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const modeRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ upload: null, link: null });
  // Lượt tải đang chạy; số lượt tăng mỗi lần bắt đầu hoặc huỷ để bỏ kết quả của lượt cũ
  const attempt = useRef(0);
  const running = useRef<RunningUpload | null>(null);
  const preview = useRef<string | null>(null);
  const notify = useRef(onUploadingChange);
  notify.current = onUploadingChange;

  const releasePreview = () => {
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null;
  };

  /** Dừng lượt đang tải (nếu có), không báo lỗi */
  const cancel = () => {
    attempt.current += 1;
    running.current?.abort();
    running.current = null;
    releasePreview();
    setUploading(null);
    notify.current(false);
  };

  // Rời trang khi đang tải: huỷ lượt tải, trả object URL
  useEffect(
    () => () => {
      attempt.current += 1;
      running.current?.abort();
      if (preview.current) URL.revokeObjectURL(preview.current);
    },
    [],
  );

  const start = async (file: File) => {
    const invalid = checkImageFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    cancel();
    const id = attempt.current;
    setError(null);
    preview.current = typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : null;
    setUploading({ preview: preview.current, percent: 0 });
    notify.current(true);
    try {
      const ticket = await requestImageUpload(file);
      if (id !== attempt.current) return;
      const upload = uploadImageFile(ticket.upload, file, (percent) => {
        if (id === attempt.current) setUploading((u) => (u ? { ...u, percent } : u));
      });
      running.current = upload;
      await upload.done;
      if (id !== attempt.current) return;
      onChange(ticket.imageUrl);
    } catch (err) {
      if (id !== attempt.current || err instanceof UploadAbortedError) return;
      setError(UPLOAD_FAILED);
    } finally {
      if (id === attempt.current) {
        running.current = null;
        releasePreview();
        setUploading(null);
        notify.current(false);
      }
    }
  };

  const pick = () => inputRef.current?.click();
  const remove = () => {
    if (uploading) return cancel();
    setError(null);
    onChange('');
  };

  const chooseMode = (next: Mode) => {
    if (next === mode) return;
    if (uploading) cancel();
    setError(null);
    setMode(next);
  };
  // Nhóm radio: mũi tên trái, phải đổi lựa chọn và chuyển focus
  const onModeKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const next: Mode = mode === 'upload' ? 'link' : 'upload';
    chooseMode(next);
    modeRefs.current[next]?.focus();
  };

  const onDragOver = (event: DragEvent) => {
    if (disabled) return;
    event.preventDefault();
    setDragging(true);
  };
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (!disabled && file) void start(file);
  };

  const hasImage = value.trim() !== '';
  const frameClass = [
    styles.frame,
    !uploading && !hasImage ? styles.empty : '',
    dragging ? styles.dragging : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.root}>
      <div role="radiogroup" aria-label="Cách thêm ảnh" className={styles.segments}>
        {MODES.map((m) => (
          <button
            key={m.value}
            ref={(el) => {
              modeRefs.current[m.value] = el;
            }}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            tabIndex={mode === m.value ? 0 : -1}
            className={styles.segment}
            onClick={() => chooseMode(m.value)}
            onKeyDown={onModeKey}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'link' ? (
        <>
          <Field
            label="Đường dẫn ảnh (https)"
            type="url"
            placeholder="https://…"
            value={value}
            maxLength={LIMITS.imageUrl}
            error={urlError}
            onChange={(e) => onChange(e.target.value)}
          />
          <ImagePreview url={value} />
        </>
      ) : (
        <>
          <div
            className={frameClass}
            aria-busy={uploading ? true : undefined}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            {uploading ? (
              <>
                {uploading.preview && (
                  <img src={uploading.preview} alt="" className={styles.uploadingImage} />
                )}
                <div className={styles.progress}>
                  <span role="status" aria-live="polite">
                    Đang tải ảnh… {uploading.percent}%
                  </span>
                  <div
                    role="progressbar"
                    aria-label="Tiến độ tải ảnh"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={uploading.percent}
                    className={styles.track}
                  >
                    <span className={styles.bar} style={{ width: `${uploading.percent}%` }} />
                  </div>
                </div>
              </>
            ) : hasImage ? (
              <ImagePreview url={value} />
            ) : (
              <div className={styles.placeholder}>
                <ImagePlus size={28} aria-hidden="true" />
                <span>Kéo ảnh vào đây hoặc</span>
                <Button size="sm" onClick={pick} disabled={disabled}>
                  Tải ảnh từ máy
                </Button>
                <span className={styles.hint}>JPG, PNG hoặc WebP, tối đa 3 MB</span>
              </div>
            )}
            {(uploading || hasImage) && (
              <button
                type="button"
                className={styles.remove}
                aria-label="Bỏ ảnh này"
                title={uploading ? 'Huỷ tải ảnh' : 'Bỏ ảnh này'}
                onClick={remove}
                disabled={disabled}
              >
                <X size={18} aria-hidden="true" />
              </button>
            )}
          </div>
          {hasImage && !uploading && (
            <Button size="sm" onClick={pick} disabled={disabled} className={styles.change}>
              <ImagePlus size={16} aria-hidden="true" />
              Đổi ảnh
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            className={styles.input}
            tabIndex={-1}
            aria-hidden="true"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Cho chọn lại đúng tệp vừa chọn (sau khi bỏ hoặc lỗi)
              e.target.value = '';
              if (file) void start(file);
            }}
          />
          {(error ?? urlError) && (
            <p role="alert" className={styles.error}>
              {error ?? urlError}
            </p>
          )}
        </>
      )}
    </div>
  );
}
