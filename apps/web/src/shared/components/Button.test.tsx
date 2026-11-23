// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Button } from './Button';
import { buttonClass } from './buttonClass';
import styles from './Button.module.css';

afterEach(cleanup);

describe('buttonClass', () => {
  it('buttonClass_defaultsToSecondaryMd', () => {
    // Act
    const cls = buttonClass().split(' ');

    // Assert
    expect(cls).toEqual([styles.button, styles.secondary, styles.md]);
  });

  it.each([
    ['primary', 'lg'],
    ['ghost', 'sm'],
    ['danger', 'md'],
  ] as const)('buttonClass_hasVariantAndSize_%s_%s', (variant, size) => {
    // Act
    const cls = buttonClass({ variant, size }).split(' ');

    // Assert
    expect(cls).toContain(styles[variant]);
    expect(cls).toContain(styles[size]);
    expect(cls).not.toContain(styles.block);
  });

  it('buttonClass_addsBlock_whenBlock', () => {
    expect(buttonClass({ block: true }).split(' ')).toContain(styles.block);
  });
});

describe('Button', () => {
  it('button_defaultsToTypeButton_andNotBusy', () => {
    // Act
    render(<Button>Xem thêm đơn</Button>);

    // Assert: không vô tình gửi form
    const button = screen.getByRole('button', { name: 'Xem thêm đơn' });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toHaveAttribute('aria-busy');
    expect(button).toBeEnabled();
    expect(button).toHaveClass(styles.secondary!, styles.md!);
  });

  it('button_keepsTypeSubmit_andExtraClassName', () => {
    render(
      <Button type="submit" variant="primary" size="lg" className="extra">
        Xác nhận đặt hàng
      </Button>,
    );

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass(styles.primary!, styles.lg!, 'extra');
  });

  it('button_blocksClick_whenBusy', () => {
    // Arrange
    const onClick = vi.fn();
    render(
      <Button variant="danger" busy onClick={onClick}>
        Đang huỷ…
      </Button>,
    );

    // Act
    const button = screen.getByRole('button', { name: 'Đang huỷ…' });
    fireEvent.click(button);

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
    // Verify
    expect(onClick).not.toHaveBeenCalled();
  });
});
