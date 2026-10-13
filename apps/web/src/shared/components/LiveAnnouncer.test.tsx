// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { useAnnounce, type Announcer } from '../hooks/useAnnounce';
import { LiveAnnouncerProvider } from './LiveAnnouncer';

afterEach(cleanup);

let announcer: Announcer;
function Capture() {
  announcer = useAnnounce();
  return null;
}

describe('LiveAnnouncerProvider', () => {
  it('đưa câu vào đúng vùng: polite cho trạng thái, alert cho lỗi', () => {
    const { container } = render(
      <LiveAnnouncerProvider>
        <Capture />
      </LiveAnnouncerProvider>,
    );
    act(() => announcer.polite('Đã thêm RTX 4060 vào giỏ.'));
    act(() => announcer.alert('Giỏ hàng đã đủ 50 sản phẩm.'));

    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
      'Đã thêm RTX 4060 vào giỏ.',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Giỏ hàng đã đủ 50 sản phẩm.');
  });

  it('câu trùng lần trước được gắn vào phần tử mới để trình đọc đọc lại', () => {
    const { container } = render(
      <LiveAnnouncerProvider>
        <Capture />
      </LiveAnnouncerProvider>,
    );
    act(() => announcer.polite('Đã thêm A vào giỏ.'));
    const first = container.querySelector('[aria-live="polite"] span');
    act(() => announcer.polite('Đã thêm A vào giỏ.'));
    const second = container.querySelector('[aria-live="polite"] span');
    expect(second).not.toBe(first);
  });

  it('không có provider: gọi không lỗi', () => {
    render(<Capture />);
    expect(() => announcer.polite('x')).not.toThrow();
  });
});
