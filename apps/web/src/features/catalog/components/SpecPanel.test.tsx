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

  it('cuộn thân: phần trên cùng đang thấy thành mục đang xem, trừ 400ms ngay sau khi mở', () => {
    // IntersectionObserver giả: giữ callback để test báo phần nào đang thấy
    let report: ((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (entries: Partial<IntersectionObserverEntry>[]) => void) {
          report = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    openPanel({ index: 0 });
    const sectionAt = (name: string) => screen.getByRole('region', { name });
    const seen = (name: string) => () =>
      report?.([{ target: sectionAt(name), isIntersecting: true }]);

    // Ngay sau khi mở: kết quả theo dõi bị bỏ qua, mục vừa chọn giữ nguyên
    act(seen('khoa_moi'));
    expect(tocItem('VRAM')).toHaveAttribute('aria-current', 'true');

    // Quá 400ms: phần đang thấy thành mục đang xem
    act(() => vi.advanceTimersByTime(500));
    act(seen('khoa_moi'));
    expect(tocItem('khoa_moi')).toHaveAttribute('aria-current', 'true');
    expect(tocItem('VRAM')).not.toHaveAttribute('aria-current');
  });
});
