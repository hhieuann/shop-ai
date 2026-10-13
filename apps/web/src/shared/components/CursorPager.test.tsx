// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { CursorPager, type PagerTarget } from './CursorPager';

afterEach(cleanup);

function CurrentLocation() {
  const location = useLocation();
  return (
    <>
      <p data-testid="url">{`${location.pathname}${location.search}`}</p>
      <p data-testid="state">{JSON.stringify(location.state)}</p>
    </>
  );
}

function renderPager(props: {
  page: number;
  previous?: PagerTarget;
  next?: PagerTarget;
  onNavigate?: () => void;
}) {
  return render(
    <MemoryRouter initialEntries={['/products']}>
      <CursorPager {...props} />
      <Routes>
        <Route path="*" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CursorPager', () => {
  it('trang 1 còn trang sau: Trước vô hiệu, Trang 1, Sau là link', () => {
    renderPager({ page: 1, next: { to: '/products?cursor=c2&page=2' } });

    const nav = screen.getByRole('navigation', { name: 'Phân trang' });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trang trước' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Trang trước' })).not.toHaveAttribute('href');
    expect(screen.getByText('Trang 1')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Trang sau' })).toHaveAttribute(
      'href',
      '/products?cursor=c2&page=2',
    );
  });

  it('trang cuối: Sau vô hiệu, Trước là link', () => {
    renderPager({ page: 3, previous: { to: '/products?cursor=c2&page=2' } });

    expect(screen.getByRole('link', { name: 'Trang sau' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(screen.getByRole('link', { name: 'Trang trước' })).toHaveAttribute('href');
    expect(screen.getByText('Trang 3')).toBeInTheDocument();
  });

  it('chỉ có 1 trang: không hiện gì', () => {
    renderPager({ page: 1 });

    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).toBeNull();
  });

  it('bấm Sau: sang đúng URL, mang state, gọi onNavigate', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    renderPager({
      page: 1,
      next: { to: '/products?cursor=c2&page=2', state: { prevCursors: [''] } },
      onNavigate,
    });

    await user.click(screen.getByRole('link', { name: 'Trang sau' }));

    expect(screen.getByTestId('url')).toHaveTextContent('/products?cursor=c2&page=2');
    expect(screen.getByTestId('state')).toHaveTextContent('{"prevCursors":[""]}');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });
});
