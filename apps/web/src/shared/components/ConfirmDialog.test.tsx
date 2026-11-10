// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
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
