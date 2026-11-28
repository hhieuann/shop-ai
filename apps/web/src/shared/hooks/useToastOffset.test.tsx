// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { useRef } from 'react';
import { TOAST_OFFSET_VAR, useToastOffset } from './useToastOffset';

/** ResizeObserver giả: test gọi `resize()` để giả thanh đổi cao */
class FakeResizeObserver {
  static last: FakeResizeObserver | undefined;
  disconnected = false;
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.last = this;
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  resize() {
    this.callback();
  }
}

function Bar({ height }: { height: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useToastOffset(ref);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        // jsdom không tính bố cục: gán chiều cao để hook đọc
        if (el) Object.defineProperty(el, 'offsetHeight', { configurable: true, value: height });
      }}
    />
  );
}

const offset = () => document.documentElement.style.getPropertyValue(TOAST_OFFSET_VAR);

beforeEach(() => vi.stubGlobal('ResizeObserver', FakeResizeObserver));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.documentElement.style.removeProperty(TOAST_OFFSET_VAR);
});

describe('useToastOffset (design-system §9.33)', () => {
  it('setsVarToBarHeight_onMount', () => {
    // Act
    render(<Bar height={65} />);

    // Assert
    expect(offset()).toBe('65px');
  });

  it('updatesVar_whenBarGrows', () => {
    // Arrange
    const { container } = render(<Bar height={65} />);
    const bar = container.firstElementChild as HTMLElement;

    // Act: điện thoại, thanh xuống hai dòng khi có câu báo
    Object.defineProperty(bar, 'offsetHeight', { configurable: true, value: 110 });
    act(() => FakeResizeObserver.last!.resize());

    // Assert
    expect(offset()).toBe('110px');
  });

  it('removesVarAndStopsObserving_onUnmount', () => {
    // Arrange
    const { unmount } = render(<Bar height={65} />);

    // Act
    unmount();

    // Assert: các trang khác giữ khoảng cách mặc định
    expect(offset()).toBe('');
    expect(FakeResizeObserver.last!.disconnected).toBe(true);
  });
});
