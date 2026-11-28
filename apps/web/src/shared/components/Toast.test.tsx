// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { TOAST_DURATION_MS, ToastProvider } from './Toast';
import { useToast } from './toastContext';

function Sender({ text = 'Đã ẩn "Card RTX 4060" khỏi cửa hàng.' }: { text?: string }) {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.show(text)}>
      Gửi
    </button>
  );
}

function setup(text?: string) {
  render(
    <ToastProvider>
      <Sender text={text} />
    </ToastProvider>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('show_rendersMessageInStatusRegion_withCloseButton', () => {
    // Act
    setup();

    // Assert
    const region = screen.getByRole('status');
    expect(region).toHaveTextContent('Đã ẩn "Card RTX 4060" khỏi cửa hàng.');
    expect(screen.getByRole('button', { name: 'Đóng thông báo' })).toBeInTheDocument();
    // Không dời focus của người dùng
    expect(screen.getByRole('button', { name: 'Gửi' })).not.toHaveFocus();
  });

  it('statusRegion_existsBeforeAnyMessage', () => {
    // Act
    render(
      <ToastProvider>
        <Sender />
      </ToastProvider>,
    );

    // Assert: vùng đọc có sẵn để trình đọc màn hình nhận câu đầu tiên
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('autoHides_afterDuration', () => {
    // Arrange
    setup();

    // Act
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    });
    const stillThere = screen.getByRole('status').textContent;
    act(() => {
      vi.advanceTimersByTime(1);
    });

    // Assert
    expect(stillThere).not.toBe('');
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('hover_pausesTimer_andLeavingRestartsIt', () => {
    // Arrange
    setup();
    const toast = screen.getByText(/Đã ẩn/).parentElement as HTMLElement;

    // Act
    fireEvent.mouseEnter(toast);
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS * 2);
    });

    // Assert: đang rê chuột thì không ẩn
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement();

    // Act: rời chuột thì đếm lại từ đầu
    fireEvent.mouseLeave(toast);
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS);
    });

    // Assert
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('focus_pausesTimer', () => {
    // Arrange
    setup();

    // Act
    act(() => {
      screen.getByRole('button', { name: 'Đóng thông báo' }).focus();
    });
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS * 2);
    });

    // Assert
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement();
  });

  it('closeButton_hidesImmediately', () => {
    // Arrange
    setup();

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));

    // Assert
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('newMessage_replacesCurrent_andRestartsTimer', () => {
    // Arrange
    setup('Câu một');
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1000);
    });

    // Act
    fireEvent.click(screen.getByRole('button', { name: 'Gửi' }));
    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    });

    // Assert: câu gửi lại vẫn hiện, chỉ một thông báo
    expect(screen.getByRole('status')).toHaveTextContent('Câu một');
    expect(screen.getAllByRole('button', { name: 'Đóng thông báo' })).toHaveLength(1);
  });

  it('useToast_throws_withoutProvider', () => {
    // Arrange
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Act
    const act_ = () => render(<Sender />);

    // Assert
    expect(act_).toThrow('useToast cần ToastProvider');
    spy.mockRestore();
  });
});
