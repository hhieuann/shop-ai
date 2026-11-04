// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import type { SpecEntry } from '../lib/specLabels';
import { SpecPanel } from './SpecPanel';

const ROWS: SpecEntry[] = [
  { key: 'vram', label: 'VRAM', value: '12GB GDDR6X' },
  { key: 'nguon_de_xuat', label: 'Nguồn đề xuất', value: '650W' },
  { key: 'kich_thuoc', label: 'Kích thước', value: '301mm' },
  { key: 'khoa_moi', label: 'khoa_moi', value: 'abc' },
];

/** Trang giả: một nút mở panel từ thông số `index`, đóng xong gỡ panel như trang thật */
function Harness({ index = 2, onClose }: { index?: number; onClose?: () => void }) {
  const [opener, setOpener] = useState<HTMLElement | null>(null);
  return (
    <>
      <button type="button" onClick={(e) => setOpener(e.currentTarget)}>
        Mở thông số
      </button>
      {opener && (
        <SpecPanel
          category="gpu"
          rows={ROWS}
          initialIndex={index}
          opener={opener}
          onClose={() => {
            onClose?.();
            setOpener(null);
          }}
        />
      )}
    </>
  );
}

function openPanel(props: { index?: number; onClose?: () => void } = {}) {
  render(<Harness {...props} />);
  const opener = screen.getByRole('button', { name: 'Mở thông số' });
  fireEvent.click(opener);
  return opener;
}

const dialog = () => screen.getByRole('dialog', { name: 'Thông số kỹ thuật' });
const tocItem = (name: string) =>
  within(screen.getByRole('navigation', { name: 'Các thông số' })).getByRole('button', { name });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.documentElement.style.overflow = '';
});

describe('SpecPanel', () => {
  it('mở từ thông số thứ 3: mục đó được đánh dấu, focus ở nút Đóng', () => {
    openPanel({ index: 2 });
    expect(tocItem('Kích thước')).toHaveAttribute('aria-current', 'true');
    expect(tocItem('VRAM')).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus();
    expect(dialog()).toHaveAttribute('aria-modal', 'true');
  });

  it('khoá cuộn trang nền khi mở, trả lại khi gỡ', () => {
    openPanel();
    expect(document.documentElement.style.overflow).toBe('hidden');

    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    act(() => vi.advanceTimersByTime(300));

    expect(document.documentElement.style.overflow).toBe('');
  });

  it.each([
    ['nút Đóng', () => fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))],
    ['phím Esc', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['bấm vùng tối', () => fireEvent.click(dialog().previousElementSibling as Element)],
  ])('đóng bằng %s: trượt ra rồi gọi onClose, focus về ô đã mở', (_, close) => {
    const onClose = vi.fn();
    const opener = openPanel({ onClose });

    close();
    // Chưa gỡ ngay: chờ trượt ra (transitionend hoặc hẹn giờ dự phòng)
    expect(onClose).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(opener).toHaveFocus();
  });

  it('Tab ở phần tử cuối quay về nút Đóng (giữ focus trong panel)', () => {
    openPanel();
    const last = tocItem('khoa_moi');
    last.focus();

    fireEvent.keyDown(last, { key: 'Tab' });

    expect(screen.getByRole('button', { name: 'Đóng' })).toHaveFocus();
  });

  it('bấm mục lục thì mục đó thành mục đang xem', () => {
    openPanel({ index: 0 });

    fireEvent.click(tocItem('Nguồn đề xuất'));

    expect(tocItem('Nguồn đề xuất')).toHaveAttribute('aria-current', 'true');
    expect(tocItem('VRAM')).not.toHaveAttribute('aria-current');
  });

  it('mỗi thông số một tiêu đề h3, có giá trị và nhãn "Sản phẩm này"', () => {
    openPanel();
    const headings = within(dialog()).getAllByRole('heading', { level: 3 });
    expect(headings.map((h) => h.textContent)).toEqual([
      'VRAM',
      'Nguồn đề xuất',
      'Kích thước',
      'khoa_moi',
    ]);
    const section = screen.getByRole('region', { name: 'VRAM' });
    expect(section).toHaveTextContent('12GB GDDR6X');
    expect(section).toHaveTextContent('Sản phẩm này');
  });

  it('câu giải thích theo loại hàng (gpu.kich_thuoc), khoá lạ thì báo chưa có', () => {
    openPanel();
    expect(screen.getByRole('region', { name: 'Kích thước' })).toHaveTextContent(
      'Chiều dài của card, đo bằng mm.',
    );
    expect(screen.getByRole('region', { name: 'khoa_moi' })).toHaveTextContent(
      'Chưa có phần giải thích cho thông số này.',
    );
  });

  it('đóng hai lần liền (Esc rồi bấm vùng tối) chỉ gọi onClose một lần', () => {
    const onClose = vi.fn();
    openPanel({ onClose });

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(dialog().previousElementSibling as Element);
    act(() => vi.advanceTimersByTime(300));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SpecPanel: mục lục và theo dõi cuộn', () => {
  /** IntersectionObserver giả: giữ callback và tuỳ chọn để test báo phần nào đang thấy */
  let report: ((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined;
  let options: IntersectionObserverInit | undefined;
  beforeEach(() => {
    report = undefined;
    options = undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(
          cb: (entries: Partial<IntersectionObserverEntry>[]) => void,
          init?: IntersectionObserverInit,
        ) {
          report = cb;
          options = init;
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  const sectionAt = (name: string) => screen.getByRole('region', { name });
  /** Chỉ phần `name` đang thấy (các phần khác ra khỏi vùng theo dõi) */
  const onlySeen = (name: string) => () =>
    report?.(
      ROWS.map((row) => ({
        target: sectionAt(row.label),
        isIntersecting: row.label === name,
      })),
    );
  const scrollEnd = () => fireEvent(sectionAt('VRAM').parentElement!, new Event('scrollend'));
  const marked = () =>
    within(screen.getByRole('navigation', { name: 'Các thông số' }))
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-current') === 'true')
      .map((b) => b.textContent);

  it('phần trước chỉ chạm mép trên không tính: rootMargin trên là -1px', () => {
    openPanel({ index: 0 });
    expect(options?.rootMargin).toBe('-1px 0px -60% 0px');
  });

  it('vừa mở: bỏ qua kết quả theo dõi tới khi thân cuộn xong, sau đó theo dõi lại', () => {
    openPanel({ index: 0 });

    act(onlySeen('khoa_moi'));
    expect(marked()).toEqual(['VRAM']);

    act(scrollEnd);
    act(onlySeen('khoa_moi'));
    expect(marked()).toEqual(['khoa_moi']);
  });

  it('bấm mục phía trên: giữa lúc cuộn báo phần trước vẫn giữ mục đã bấm, cuộn xong theo dõi lại', () => {
    openPanel({ index: 3 });
    act(scrollEnd);

    fireEvent.click(tocItem('Kích thước'));
    // Cuộn mượt lâu hơn 400ms: phần ngay trước lọt vào vùng theo dõi trước khi cuộn xong
    act(() => vi.advanceTimersByTime(500));
    act(onlySeen('Nguồn đề xuất'));
    expect(marked()).toEqual(['Kích thước']);

    // Tới nơi: thân dừng ở mục đã bấm, chỉ còn mục đó trong vùng theo dõi
    act(onlySeen('Kích thước'));
    act(scrollEnd);
    expect(marked()).toEqual(['Kích thước']);

    // Cuộn xong rồi người dùng tự cuộn: kết quả theo dõi lại có tác dụng
    act(onlySeen('Nguồn đề xuất'));
    expect(marked()).toEqual(['Nguồn đề xuất']);
  });

  it('không có scrollend: sau 1000ms coi như đã cuộn xong, theo dõi lại', () => {
    openPanel({ index: 0 });
    act(scrollEnd);
    fireEvent.click(tocItem('khoa_moi'));

    act(() => vi.advanceTimersByTime(999));
    act(onlySeen('Kích thước'));
    expect(marked()).toEqual(['khoa_moi']);

    act(() => vi.advanceTimersByTime(1));
    act(onlySeen('Kích thước'));
    expect(marked()).toEqual(['Kích thước']);
  });

  it('bấm mục khác giữa lúc cuộn: kết thúc ở mục bấm sau, không còn hẹn giờ cũ', () => {
    openPanel({ index: 3 });
    act(scrollEnd);

    fireEvent.click(tocItem('Kích thước'));
    act(() => vi.advanceTimersByTime(600));
    fireEvent.click(tocItem('Nguồn đề xuất'));

    // Hẹn giờ của lần bấm đầu (lẽ ra hết ở 1000ms) không còn: vẫn bỏ qua kết quả theo dõi
    act(() => vi.advanceTimersByTime(500));
    act(onlySeen('VRAM'));
    expect(marked()).toEqual(['Nguồn đề xuất']);

    act(onlySeen('Nguồn đề xuất'));
    act(scrollEnd);
    expect(marked()).toEqual(['Nguồn đề xuất']);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('người dùng tự cuộn lúc đang chờ, không có scrollend: hết 1000ms đánh dấu phần đang thấy', () => {
    openPanel({ index: 0 });

    act(onlySeen('Kích thước'));
    expect(marked()).toEqual(['VRAM']);

    act(() => vi.advanceTimersByTime(1000));
    expect(marked()).toEqual(['Kích thước']);
  });

  it('người dùng tự cuộn lúc đang chờ, có scrollend: đánh dấu phần đang thấy', () => {
    openPanel({ index: 0 });

    act(onlySeen('Kích thước'));
    act(scrollEnd);
    expect(marked()).toEqual(['Kích thước']);
  });

  it('bấm mục phía trên, tới nơi chỉ thấy mục đó: cuộn xong vẫn là mục đã bấm', () => {
    openPanel({ index: 3 });
    act(scrollEnd);

    fireEvent.click(tocItem('Kích thước'));
    act(onlySeen('Kích thước'));
    act(scrollEnd);
    expect(marked()).toEqual(['Kích thước']);
  });

  it('cuộn xong mà không thấy phần nào: giữ mục đã bấm', () => {
    openPanel({ index: 0 });
    act(scrollEnd);

    fireEvent.click(tocItem('khoa_moi'));
    act(() =>
      report?.(ROWS.map((row) => ({ target: sectionAt(row.label), isIntersecting: false }))),
    );
    act(scrollEnd);
    expect(marked()).toEqual(['khoa_moi']);
  });
});
