// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { SpecTable } from './SpecTable';

afterEach(cleanup);

describe('SpecTable', () => {
  it('có tiêu đề và mỗi thông số một hàng: nhãn có dấu, giá trị', () => {
    render(<SpecTable specs={{ vram: '8GB GDDR6', nguon_de_xuat: '550W' }} />);
    expect(screen.getByRole('heading', { name: 'Thông số kỹ thuật' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Thông số kỹ thuật' });
    const rows = within(table).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByRole('rowheader')).toHaveTextContent('VRAM');
    expect(rows[0]).toHaveTextContent('8GB GDDR6');
    expect(within(rows[1]!).getByRole('rowheader')).toHaveTextContent('Nguồn đề xuất');
  });

  it('không có specs, hoặc không có giá trị in được, thì không render khối nào', () => {
    const { container, rerender } = render(<SpecTable specs={undefined} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<SpecTable specs={{ quat: { so: 3 } }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
