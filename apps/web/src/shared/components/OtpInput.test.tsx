// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentProps } from 'react';
import { OtpInput } from './OtpInput';
import styles from './OtpInput.module.css';

afterEach(cleanup);

type Props = ComponentProps<typeof OtpInput>;

/** Bọc state như CodeStep, để kiểm giá trị thật sau khi gõ, dán */
function Harness(props: Partial<Props>) {
  const [value, setValue] = useState(props.value ?? '');
  return (
    <OtpInput
      label="Mã xác nhận"
      {...props}
      value={value}
      onChange={(next) => {
        setValue(next);
        props.onChange?.(next);
      }}
    />
  );
}

function setup(props: Partial<Props> = {}) {
  const onComplete = vi.fn();
  const onChange = vi.fn();
  const view = render(<Harness onComplete={onComplete} onChange={onChange} {...props} />);
  const input = screen.getByLabelText('Mã xác nhận') as HTMLInputElement;
  const boxes = () => Array.from(view.container.querySelectorAll(`.${styles.box}`));
  return { user: userEvent.setup(), input, boxes, onComplete, onChange };
}

describe('OtpInput', () => {
  it('render_hasOneLabelledInput_andSixHiddenBoxes', () => {
    // Arrange
    const { input, boxes } = setup();

    // Assert
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).not.toHaveAttribute('maxlength');
    expect(boxes()).toHaveLength(6);
    for (const box of boxes()) expect(box).toHaveAttribute('aria-hidden', 'true');
  });

  it('type_keepsOnlyDigits', async () => {
    // Arrange
    const { user, input, boxes } = setup();

    // Act
    await user.type(input, '12a3');

    // Assert
    expect(input).toHaveValue('123');
    expect(boxes().map((box) => box.textContent)).toEqual(['1', '2', '3', '', '', '']);
  });

  it('paste_keepsSixDigits_whenCodeHasSpace', async () => {
    // Arrange
    const { user, input, onComplete } = setup();
    await user.click(input);

    // Act
    await user.paste('123 456');

    // Assert
    expect(input).toHaveValue('123456');
    // Verify
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('paste_keepsSixDigits_whenCodeHasLetters', async () => {
    // Arrange
    const { user, input, onComplete } = setup();
    await user.click(input);

    // Act
    await user.paste('Mã: 123456');

    // Assert
    expect(input).toHaveValue('123456');
    // Verify
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('type_cutsToLength_andCompletesOnce', async () => {
    // Arrange
    const { user, input, onComplete } = setup();

    // Act
    await user.type(input, '12345678');

    // Assert
    expect(input).toHaveValue('123456');
    // Verify: gõ thêm khi đã đủ số không gọi lại
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('backspace_removesLastDigit', async () => {
    // Arrange
    const { user, input } = setup();
    await user.type(input, '1234');

    // Act
    await user.keyboard('{Backspace}');

    // Assert
    expect(input).toHaveValue('123');
  });

  it('error_marksInputInvalid_andDescribedByMessage', () => {
    // Arrange
    const { input, boxes } = setup({ error: 'Mã không đúng.' });

    // Assert
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Mã không đúng.');
    for (const box of boxes()) expect(box).toHaveClass(styles.invalid);
  });

  it('readOnly_ignoresTyping', async () => {
    // Arrange
    const { user, input, onChange } = setup({ readOnly: true });

    // Act
    await user.type(input, '12');

    // Assert
    expect(input).toHaveValue('');
    // Verify
    expect(onChange).not.toHaveBeenCalled();
  });

  it('focus_highlightsFirstEmptyBox_andBlurClearsIt', async () => {
    // Arrange
    const { user, input, boxes } = setup();

    // Act
    await user.type(input, '12');

    // Assert: ô trống đầu tiên (thứ 3) sáng, có vạch nháy
    const active = boxes().filter((box) => box.classList.contains(styles.active));
    expect(active).toEqual([boxes()[2]]);
    expect(boxes()[2].querySelector(`.${styles.caret}`)).not.toBeNull();

    // Act
    await user.tab();

    // Assert
    expect(input).not.toHaveFocus();
    expect(boxes().some((box) => box.classList.contains(styles.active))).toBe(false);
  });
});
