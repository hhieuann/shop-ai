// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Footer } from './Footer';

afterEach(cleanup);

describe('Footer', () => {
  it('có cột Mua sắm, Tài khoản với đúng đường dẫn và dòng demo', () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>,
    );
    const shop = screen.getByRole('navigation', { name: 'Mua sắm' });
    expect(
      within(shop)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual([
      '/products',
      '/products?sort=newest',
      '/products?category=gpu',
      '/products?category=laptop',
    ]);
    const account = screen.getByRole('navigation', { name: 'Tài khoản' });
    expect(
      within(account)
        .getAllByRole('link')
        .map((a) => a.getAttribute('href')),
    ).toEqual(['/login', '/register', '/orders']);
    expect(screen.getByText('Thanh toán khi nhận hàng (COD)')).toBeInTheDocument();
    expect(
      screen.getByText('© 2026 Black Magic · Sản phẩm, giá và tồn kho chỉ dùng để demo.'),
    ).toBeInTheDocument();
  });
});
