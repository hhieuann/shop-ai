// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Breadcrumb } from './Breadcrumb';

afterEach(cleanup);

describe('Breadcrumb', () => {
  it('mục trước là link, mục cuối là trang hiện tại, danh sách chỉ có đúng số mục', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Card đồ hoạ' }]} />
      </MemoryRouter>,
    );
    const nav = screen.getByRole('navigation', { name: 'Đường dẫn' });
    expect(within(nav).getAllByRole('listitem')).toHaveLength(2);
    expect(within(nav).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/');
    const current = within(nav).getByText('Card đồ hoạ');
    expect(current).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('link', { name: 'Card đồ hoạ' })).toBeNull();
  });
});
