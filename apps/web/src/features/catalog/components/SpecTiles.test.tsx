// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { SpecEntry } from '../lib/specLabels';
import { SpecTiles } from './SpecTiles';

/** ResizeObserver giả: giữ callback để test tự gọi khi "đổi bề rộng" */
let resize: (() => void) | undefined;
const disconnect = vi.fn();
let width = 0;

beforeEach(() => {
  resize = undefined;
  width = 0;
  disconnect.mockClear();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: () => void) {
        resize = cb;
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  // jsdom không tính layout: bề rộng danh sách và --spec-tile-min do test đặt
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
  vi.spyOn(window, 'getComputedStyle').mockImplementation(
    () => ({ getPropertyValue: () => '220px' }) as unknown as CSSStyleDeclaration,
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const ROWS: SpecEntry[] = [
  { key: 'cpu', label: 'CPU', value: 'Ryzen 7 7735HS' },
  { key: 'gpu', label: 'GPU', value: 'RTX 4060 8GB' },
  { key: 'ram', label: 'RAM', value: '16GB DDR5' },
  { key: 'ssd', label: 'SSD', value: '512GB NVMe' },
  { key: 'man_hinh', label: 'Màn hình', value: '15.6" FHD 144Hz' },
];

const cols = () => screen.getByRole('list').style.getPropertyValue('--spec-cols');

function resizeTo(next: number) {
  width = next;
  act(() => resize?.());
}

describe('SpecTiles', () => {
  it('không có dòng nào thì không vẽ gì', () => {
    const { container } = render(<SpecTiles rows={[]} onOpen={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('mỗi thông số là một nút mở hộp thoại, tên đọc được là "nhãn giá trị", có title', () => {
    render(<SpecTiles rows={ROWS} onOpen={vi.fn()} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual([
      'CPU Ryzen 7 7735HS',
      'GPU RTX 4060 8GB',
      'RAM 16GB DDR5',
      'SSD 512GB NVMe',
      'Màn hình 15.6" FHD 144Hz',
    ]);
    expect(screen.getByRole('button', { name: 'CPU Ryzen 7 7735HS' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(screen.getByTitle('15.6" FHD 144Hz')).toBeInTheDocument();
  });

  it('chưa đo được bề rộng thì 2 cột, chỉ 1 thông số thì 1 cột', () => {
    render(<SpecTiles rows={ROWS} onOpen={vi.fn()} />);
    expect(cols()).toBe('2');
    cleanup();

    render(<SpecTiles rows={ROWS.slice(0, 1)} onOpen={vi.fn()} />);
    expect(cols()).toBe('1');
  });

  it('đã có bề rộng lúc gắn: đúng số cột ngay sau lần vẽ đầu, không chờ ResizeObserver', () => {
    width = 900;
    render(<SpecTiles rows={ROWS} onOpen={vi.fn()} />);
    // 900px, ô tối thiểu 220px: tối đa 3 cột, 5 ô thành 3 + 2
    expect(cols()).toBe('3');
  });

  it('5 thông số: rộng 1360px thì 1 hàng 5 ô, thu về 810px thì 3 + 2', () => {
    render(<SpecTiles rows={ROWS} onOpen={vi.fn()} />);

    resizeTo(1360);
    expect(cols()).toBe('5');

    resizeTo(810);
    expect(cols()).toBe('3');
  });

  it('bấm ô thứ 3 thì gọi onOpen với vị trí 2 và đúng nút đó', () => {
    const onOpen = vi.fn();
    render(<SpecTiles rows={ROWS} onOpen={onOpen} />);
    const third = screen.getByRole('button', { name: 'RAM 16GB DDR5' });

    fireEvent.click(third);

    expect(onOpen).toHaveBeenCalledExactlyOnceWith(2, third);
  });

  it('gỡ component thì ngắt ResizeObserver', () => {
    const { unmount } = render(<SpecTiles rows={ROWS} onOpen={vi.fn()} />);
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
