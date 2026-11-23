// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PasswordField } from './PasswordField';

afterEach(cleanup);

function setup() {
  render(<PasswordField label="Mật khẩu" size="lg" autoComplete="current-password" />);
  return {
    input: screen.getByLabelText('Mật khẩu') as HTMLInputElement,
    toggle: () => screen.getByRole('button', { name: /mật khẩu$/ }),
  };
}

describe('PasswordField (#432)', () => {
  it('toggle_isNotInTabOrder', () => {
    const { toggle } = setup();

    expect(toggle()).toHaveAttribute('tabindex', '-1');
    expect(toggle()).toHaveAttribute('type', 'button');
  });

  it('click_switchesTypeLabelPressedAndIcon', async () => {
    // Arrange
    const user = userEvent.setup();
    const { input, toggle } = setup();

    // Assert: đang ẩn → mắt nhắm, nút nói việc sẽ làm
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle()).toHaveAccessibleName('Hiện mật khẩu');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(toggle().querySelector('svg')).toHaveClass('lucide-eye-closed');

    // Act
    await user.click(toggle());

    // Assert: đang hiện → mắt mở
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle()).toHaveAccessibleName('Ẩn mật khẩu');
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(toggle().querySelector('svg')).toHaveClass('lucide-eye');
    expect(toggle().querySelector('svg')).not.toHaveClass('lucide-eye-closed');

    // Act: bấm lần nữa thì ẩn lại
    await user.click(toggle());
    expect(input).toHaveAttribute('type', 'password');
  });

  it('click_keepsFocusInInput', async () => {
    // Arrange
    const user = userEvent.setup();
    const { input, toggle } = setup();
    await user.click(input);
    expect(input).toHaveFocus();

    // Act
    await user.click(toggle());

    // Assert: mousedown bị chặn nên focus vẫn ở ô
    expect(input).toHaveFocus();
  });

  it('toggle_sitsInsideInputControl_notNextToLabel', () => {
    const { input, toggle } = setup();

    // Nút nằm trong cùng khung với ô (khung chỉ bọc ô), nhãn ở ngoài khung
    expect(toggle().parentElement).toBe(input.parentElement);
    expect(input.parentElement?.querySelector('label')).toBeNull();
  });
});
