// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Select } from './Select';

afterEach(cleanup);

const OPTIONS = [
  { value: 'laptop', label: 'Laptop' },
  { value: 'gpu', label: 'Card đồ hoạ' },
];

describe('Select', () => {
  it('rendersLabelledNativeSelect_andReportsChange', async () => {
    // Arrange
    const onChange = vi.fn();
    render(<Select label="Loại hàng" options={OPTIONS} value="laptop" onChange={onChange} />);
    const select = screen.getByRole('combobox', { name: 'Loại hàng' });

    // Act
    await userEvent.selectOptions(select, 'gpu');

    // Assert
    expect(select.tagName).toBe('SELECT');
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Laptop',
      'Card đồ hoạ',
    ]);
    // Verify
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('hideLabel_keepsAccessibleName_butHidesLabelVisually', () => {
    // Act
    render(<Select label="Loại hàng" options={OPTIONS} hideLabel defaultValue="gpu" />);

    // Assert
    expect(screen.getByRole('combobox', { name: 'Loại hàng' })).toHaveValue('gpu');
    expect(screen.getByText('Loại hàng')).toHaveClass('sr-only');
  });

  it('error_marksInvalid_andDescribesSelect', () => {
    // Act
    render(<Select label="Loại hàng" options={OPTIONS} required error="Chọn loại hàng" />);

    // Assert
    const select = screen.getByRole('combobox', { name: /Loại hàng/ });
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAttribute('aria-required', 'true');
    expect(select).toHaveAccessibleDescription('Chọn loại hàng');
  });

  it('hint_describesSelect_whenNoError', () => {
    // Act
    render(<Select label="Loại hàng" options={OPTIONS} hint="Không đổi được sau khi lưu" />);

    // Assert
    const select = screen.getByRole('combobox', { name: 'Loại hàng' });
    expect(select).not.toHaveAttribute('aria-invalid');
    expect(select).toHaveAccessibleDescription('Không đổi được sau khi lưu');
  });
});
