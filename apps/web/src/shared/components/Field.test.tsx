// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Field } from './Field';

afterEach(cleanup);

describe('Field', () => {
  it('readonlyAppearance_isReadOnlyButFocusable', () => {
    // Act
    render(<Field label="Email" appearance="readonly" defaultValue="khachthu@example.com" />);

    // Assert: chỉ xem nhưng không disabled (vẫn Tab tới, chép được; pages/tai-khoan.md 3.1)
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('readonly');
    expect(input).not.toBeDisabled();
    expect(input.className).toMatch(/readonlyLook/);
  });

  it('defaultAppearance_isEditable_andKeepsBusyReadOnly', () => {
    // Act
    render(
      <>
        <Field label="Tên" defaultValue="" />
        <Field label="Đang gửi" readOnly defaultValue="" />
      </>,
    );

    // Assert: ô thường sửa được; ô tạm khoá lúc gửi vẫn readOnly nhưng không mang kiểu chỉ xem
    expect(screen.getByLabelText('Tên')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('Đang gửi')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Đang gửi').className).not.toMatch(/readonlyLook/);
  });
});
