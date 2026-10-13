// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import type { ProductCategory } from '../lib/productFilters';
import { FilterSheet } from './FilterSheet';

afterEach(cleanup);

/** Giống trang danh sách: nút "Lọc" mở bảng, Áp dụng thì ghi bộ lọc rồi đóng */
function Harness({ onApply = vi.fn(), onClose = vi.fn() } = {}) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ProductCategory | undefined>('gpu');
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Lọc
      </button>
      <p data-testid="applied">{category ?? 'tất cả'}</p>
      {open && (
        <FilterSheet
          category={category}
          onApply={(value) => {
            onApply(value);
            setCategory(value);
            setOpen(false);
          }}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

async function openSheet(props?: Parameters<typeof Harness>[0]) {
  const user = userEvent.setup();
  render(<Harness {...props} />);
  await user.click(screen.getByRole('button', { name: 'Lọc' }));
  return user;
}

describe('FilterSheet', () => {
  it('mở: hộp thoại modal, loại đang lọc được chọn và nhận focus, khoá cuộn trang', async () => {
    await openSheet();

    const dialog = screen.getByRole('dialog', { name: 'Bộ lọc tìm kiếm' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    const gpu = screen.getByRole('radio', { name: 'Card đồ hoạ' });
    expect(gpu).toBeChecked();
    expect(gpu).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('hidden');
  });

  it('chọn loại khác rồi "Áp dụng bộ lọc": gửi loại mới, đóng bảng, trả focus về nút Lọc', async () => {
    const onApply = vi.fn();
    const user = await openSheet({ onApply });

    await user.click(screen.getByText('Chuột'));
    await user.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith('mouse');
    expect(screen.getByTestId('applied')).toHaveTextContent('mouse');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lọc' })).toHaveFocus();
    expect(document.documentElement.style.overflow).toBe('');
  });

  it('"Bỏ chọn" đưa lựa chọn về "Tất cả loại", áp dụng thì gửi undefined', async () => {
    const onApply = vi.fn();
    const user = await openSheet({ onApply });

    await user.click(screen.getByRole('button', { name: 'Bỏ chọn' }));
    expect(screen.getByRole('radio', { name: 'Tất cả loại' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Áp dụng bộ lọc' }));

    expect(onApply).toHaveBeenCalledExactlyOnceWith(undefined);
  });

  it.each([
    [
      'nút Đóng',
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.click(screen.getByRole('button', { name: 'Đóng' }));
      },
    ],
    [
      'phím Esc',
      async (user: ReturnType<typeof userEvent.setup>) => {
        await user.keyboard('{Escape}');
      },
    ],
  ])('%s: bỏ lựa chọn tạm, bộ lọc không đổi, trả focus về nút Lọc', async (_, close) => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    const user = await openSheet({ onApply, onClose });

    await user.click(screen.getByText('Chuột'));
    await close(user);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    expect(screen.getByTestId('applied')).toHaveTextContent('gpu');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lọc' })).toHaveFocus();
  });

  it('mở lại sau khi đóng không áp dụng: lựa chọn lấy lại theo bộ lọc đang áp dụng', async () => {
    const user = await openSheet();
    await user.click(screen.getByText('Chuột'));
    await user.click(screen.getByRole('button', { name: 'Đóng' }));

    await user.click(screen.getByRole('button', { name: 'Lọc' }));

    expect(screen.getByRole('radio', { name: 'Card đồ hoạ' })).toBeChecked();
  });

  it('Tab đi vòng trong bảng: từ nút cuối về nút Đóng, Shift+Tab từ Đóng về nút cuối', async () => {
    const user = await openSheet();
    const close = screen.getByRole('button', { name: 'Đóng' });
    const apply = screen.getByRole('button', { name: 'Áp dụng bộ lọc' });

    apply.focus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.tab({ shift: true });
    expect(apply).toHaveFocus();
  });
});
