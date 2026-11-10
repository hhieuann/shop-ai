// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState, type ComponentProps } from 'react';
import { ConfirmDialog } from './ConfirmDialog';
import buttonStyles from './Button.module.css';

beforeAll(() => {
  // jsdom chưa có showModal, close của <dialog>: giả lập focus nút đầu như trình duyệt
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
    this.querySelector('button')?.focus();
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

afterEach(cleanup);

type Props = ComponentProps<typeof ConfirmDialog>;

function renderDialog(props: Partial<Props> = {}) {
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <ConfirmDialog
      title="Huỷ đơn này?"
      confirmLabel="Huỷ đơn"
      cancelLabel="Giữ đơn"
      busyLabel="Đang huỷ…"
      onConfirm={onConfirm}
      onClose={onClose}
      {...props}
    >
      Đơn sẽ bị huỷ và không khôi phục được.
    </ConfirmDialog>,
  );
  return { onConfirm, onClose };
}

/** Esc trên `<dialog>` gốc phát sự kiện `cancel` */
function pressEsc() {
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
}

describe('ConfirmDialog', () => {
  it('confirmDialog_usesPrimaryConfirm_byDefault', () => {
    // Act
    renderDialog();

    // Assert: trang admin không truyền tone, nút xác nhận vẫn primary
    const confirm = screen.getByRole('button', { name: 'Huỷ đơn' });
    expect(confirm).toHaveClass(buttonStyles.primary!, buttonStyles.md!);
    expect(confirm).not.toHaveClass(buttonStyles.danger!);
    expect(screen.getByRole('button', { name: 'Giữ đơn' })).toHaveClass(buttonStyles.secondary!);
  });

  it('confirmDialog_usesDangerConfirm_whenToneDanger', () => {
    renderDialog({ tone: 'danger' });

    const confirm = screen.getByRole('button', { name: 'Huỷ đơn' });
    expect(confirm).toHaveClass(buttonStyles.danger!);
    expect(confirm).not.toHaveClass(buttonStyles.primary!);
  });

  it('confirmDialog_focusesCancelFirst_soEnterOnlyCloses', () => {
    // Act
    renderDialog({ tone: 'danger' });

    // Assert: nút phụ đứng trước trong DOM
    const [first, second] = screen.getAllByRole('button');
    expect(first).toHaveTextContent('Giữ đơn');
    expect(second).toHaveTextContent('Huỷ đơn');
    expect(first).toHaveFocus();
  });

  it('confirmDialog_callsHandlers_whenNotBusy', () => {
    // Arrange
    const { onConfirm, onClose } = renderDialog({ tone: 'danger' });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ đơn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Giữ đơn' }));
    pressEsc();

    // Verify
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('confirmDialog_ignoresEscAndCancel_whenBusy', () => {
    // Arrange
    const { onConfirm, onClose } = renderDialog({ tone: 'danger', busy: true });

    // Act
    pressEsc();
    fireEvent.click(screen.getByRole('button', { name: 'Giữ đơn' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đang huỷ…' }));

    // Assert
    expect(screen.getByRole('button', { name: 'Đang huỷ…' })).toHaveAttribute('aria-busy', 'true');
    // Verify
    expect(onClose).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

/** Trang giả: nút mở hộp, đóng hộp bằng cách gỡ component như trang thật */
function Harness({ removeOpenerOnClose = false }: { removeOpenerOnClose?: boolean }) {
  const [open, setOpen] = useState(false);
  const [openerGone, setOpenerGone] = useState(false);
  return (
    <>
      {!openerGone && (
        <button type="button" onClick={() => setOpen(true)}>
          Mở hộp
        </button>
      )}
      <input aria-label="Ô khác" />
      {open && (
        <ConfirmDialog
          title="Chuyển đơn?"
          confirmLabel="Chuyển"
          cancelLabel="Để sau"
          busyLabel="Đang chuyển…"
          onConfirm={() => undefined}
          onClose={() => {
            setOpen(false);
            if (removeOpenerOnClose) setOpenerGone(true);
          }}
        >
          Nội dung
        </ConfirmDialog>
      )}
    </>
  );
}

describe('ConfirmDialog · trả focus khi đóng (#425)', () => {
  it('close_returnsFocusToOpener_whenFocusIsLost', async () => {
    // Arrange: nút mở có focus rồi mới mở hộp
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Mở hộp' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('button', { name: 'Để sau' })).toHaveFocus();

    // Act: đóng hộp, component bị gỡ, focus rơi về body
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('close_doesNotThrow_whenOpenerWasRemoved', async () => {
    // Arrange: trang gỡ nút mở cùng lúc với hộp (vd. dòng đơn rời danh sách)
    render(<Harness removeOpenerOnClose />);
    const opener = screen.getByRole('button', { name: 'Mở hộp' });
    opener.focus();
    fireEvent.click(opener);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));

    // Assert: không lỗi, focus không bị ép vào nút đã gỡ
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(screen.queryByRole('button', { name: 'Mở hộp' })).toBeNull();
    expect(opener).not.toHaveFocus();
  });

  it('close_keepsFocus_whenPageAlreadyMovedIt', async () => {
    // Arrange
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Mở hộp' });
    opener.focus();
    fireEvent.click(opener);

    // Act: đóng hộp, rồi trang tự đặt focus chỗ khác trước khung hình sau
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));
    const other = screen.getByRole('textbox', { name: 'Ô khác' });
    other.focus();
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    // Assert: component không giành lại focus
    expect(other).toHaveFocus();
    expect(opener).not.toHaveFocus();
  });

  it('close_doesNothing_whenNothingHadFocusOnOpen', async () => {
    // Arrange: bấm chuột trên Safari, Firefox macOS không focus nút, lúc mở focus là body
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Mở hộp' });
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.click(opener);

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

    // Assert: không có gì để trả, focus vẫn ở body, không ném lỗi
    expect(document.activeElement).toBe(document.body);
  });
});
