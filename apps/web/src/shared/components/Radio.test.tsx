// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Radio } from './Radio';

afterEach(cleanup);

function Group() {
  const [value, setValue] = useState('all');
  return (
    <fieldset>
      <legend>Loại hàng</legend>
      {[
        ['all', 'Tất cả loại'],
        ['laptop', 'Laptop'],
        ['gpu', 'Card đồ hoạ'],
      ].map(([v, label]) => (
        <Radio
          key={v}
          name="category"
          value={v}
          checked={value === v}
          onChange={() => setValue(v!)}
        >
          {label}
        </Radio>
      ))}
      <Radio name="category" value="cpu" disabled checked={false} onChange={() => setValue('cpu')}>
        CPU
      </Radio>
    </fieldset>
  );
}

describe('Radio', () => {
  it('bấm vào nhãn thì chọn, cả nhóm chỉ một mục được chọn', async () => {
    const user = userEvent.setup();
    render(<Group />);
    await user.click(screen.getByText('Card đồ hoạ'));
    expect(screen.getByRole('radio', { name: 'Card đồ hoạ' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Tất cả loại' })).not.toBeChecked();
    expect(
      screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked),
    ).toHaveLength(1);
  });

  it('Tab vào nhóm thì focus đúng radio đang chọn (input thật, không bị display:none)', async () => {
    const user = userEvent.setup();
    render(<Group />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Tất cả loại' })).toHaveFocus();
  });

  it('mũi tên xuống chuyển sang radio kế tiếp như radio gốc', async () => {
    const user = userEvent.setup();
    render(<Group />);
    await user.tab();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('radio', { name: 'Laptop' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Laptop' })).toHaveFocus();
  });

  it('radio disabled không chọn được', async () => {
    const user = userEvent.setup();
    render(<Group />);
    await user.click(screen.getByText('CPU'));
    expect(screen.getByRole('radio', { name: 'CPU' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'CPU' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'Tất cả loại' })).toBeChecked();
  });
});
