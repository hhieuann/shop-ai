// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { Switch } from './Switch';

afterEach(cleanup);

function Controlled({ onChange }: { onChange?: (checked: boolean) => void }) {
  const [checked, setChecked] = useState(true);
  return (
    <Switch
      label="Đang bán"
      description="Tắt để lưu ở trạng thái đã ẩn"
      checked={checked}
      onChange={(next) => {
        setChecked(next);
        onChange?.(next);
      }}
    />
  );
}

describe('Switch', () => {
  it('isSwitchRole_withNameDescriptionAndState', () => {
    // Act
    render(<Controlled />);

    // Assert
    const control = screen.getByRole('switch', { name: 'Đang bán' });
    expect(control).toHaveAttribute('aria-checked', 'true');
    expect(control).toHaveAccessibleDescription('Tắt để lưu ở trạng thái đã ẩn');
  });

  it('click_togglesState_andReportsNewValue', async () => {
    // Arrange
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    const control = screen.getByRole('switch', { name: 'Đang bán' });

    // Act
    await userEvent.click(control);

    // Assert
    expect(control).toHaveAttribute('aria-checked', 'false');
    // Verify
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it.each(['{Enter}', ' '])('keyboard_%s_toggles', async (key) => {
    // Arrange
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    screen.getByRole('switch').focus();

    // Act
    await userEvent.keyboard(key);

    // Assert
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('disabled_doesNotToggle', async () => {
    // Arrange
    const onChange = vi.fn();
    render(<Switch label="Đang bán" checked={false} onChange={onChange} disabled />);

    // Act
    await userEvent.click(screen.getByRole('switch'));

    // Assert
    expect(screen.getByRole('switch')).toBeDisabled();
    // Verify
    expect(onChange).not.toHaveBeenCalled();
  });
});
