// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterPanel } from './FilterPanel';

afterEach(cleanup);

describe('FilterPanel', () => {
  it('có vùng "Bộ lọc", tiêu đề, "Tất cả loại" và 13 loại; loại đang lọc được chọn', () => {
    render(<FilterPanel category="gpu" onCategoryChange={vi.fn()} />);

    expect(screen.getByRole('complementary', { name: 'Bộ lọc' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Bộ lọc tìm kiếm' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Loại hàng' });
    expect(group.querySelectorAll('input[type="radio"]')).toHaveLength(14);
    expect(screen.getByRole('radio', { name: 'Card đồ hoạ' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Tất cả loại' })).not.toBeChecked();
  });

  it('không lọc loại thì "Tất cả loại" được chọn', () => {
    render(<FilterPanel onCategoryChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: 'Tất cả loại' })).toBeChecked();
  });

  it('chọn một loại là gọi onCategoryChange ngay; "Tất cả loại" gửi undefined', async () => {
    const user = userEvent.setup();
    const onCategoryChange = vi.fn();
    render(<FilterPanel category="gpu" onCategoryChange={onCategoryChange} />);

    await user.click(screen.getByText('Chuột'));
    expect(onCategoryChange).toHaveBeenLastCalledWith('mouse');

    await user.click(screen.getByText('Tất cả loại'));
    expect(onCategoryChange).toHaveBeenLastCalledWith(undefined);
    expect(onCategoryChange).toHaveBeenCalledTimes(2);
  });

  it('bấm đầu nhóm thì thu gọn, bấm lần nữa thì mở lại', async () => {
    const user = userEvent.setup();
    render(<FilterPanel onCategoryChange={vi.fn()} />);
    const head = screen.getByRole('button', { name: 'Loại hàng' });
    expect(head).toHaveAttribute('aria-expanded', 'true');

    await user.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('radio', { name: 'Chuột' })).toBeNull();

    await user.click(head);
    expect(head).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('radio', { name: 'Chuột' })).toBeInTheDocument();
  });
});
