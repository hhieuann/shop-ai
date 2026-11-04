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

  it('có back: thêm link rút gọn "‹ loại" (chỉ hiện dưới 640px), vẫn một nav', () => {
    render(
      <MemoryRouter>
        <Breadcrumb
          items={[
            { label: 'Trang chủ', to: '/' },
            { label: 'Card đồ hoạ', to: '/products?category=gpu' },
            { label: 'RTX 4070' },
          ]}
          back={{ label: 'Card đồ hoạ', to: '/products?category=gpu' }}
        />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    const links = screen.getAllByRole('link', { name: 'Card đồ hoạ' });
    // Một link rút gọn ngoài danh sách + một link trong danh sách
    expect(links).toHaveLength(2);
    expect(links.every((a) => a.getAttribute('href') === '/products?category=gpu')).toBe(true);
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
  });

  it('không có back: không có link rút gọn', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }, { label: 'Card đồ hoạ' }]} />
      </MemoryRouter>,
    );
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('một mục có đường dẫn (trang 404) vẫn là link', () => {
    render(
      <MemoryRouter>
        <Breadcrumb items={[{ label: 'Trang chủ', to: '/' }]} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/');
  });
});
