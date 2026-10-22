// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ProductSummary } from '../../../shared/api/types';
import { ProductListCard } from './ProductListCard';

vi.mock('../../cart/hooks/useCart', () => ({
  useCart: () => ({ add: { isPending: false, mutate: vi.fn() } }),
}));

afterEach(cleanup);

const gpu: ProductSummary = {
  productId: 'p-gpu-1',
  name: 'Card màn hình MSI GeForce RTX 4060 Ventus 2X 8GB',
  category: 'gpu',
  brand: 'MSI',
  price: 7_990_000,
  stock: 12,
  status: 'ACTIVE',
  specs: { vram: '8GB GDDR6', nguon_de_xuat: '550W', cong_cap: '1x 8-pin' },
};

function renderCard(product: ProductSummary) {
  return render(
    <MemoryRouter>
      <ProductListCard product={product} />
    </MemoryRouter>,
  );
}

describe('ProductListCard', () => {
  it('có hãng, tên là link tới trang chi tiết, dòng thông số, giá, nhãn tồn kho, nút thêm giỏ', () => {
    renderCard(gpu);
    expect(screen.getByRole('article')).toBeInTheDocument();
    expect(screen.getByText('MSI')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(gpu.name);
    expect(screen.getByRole('link', { name: gpu.name })).toHaveAttribute(
      'href',
      '/products/p-gpu-1',
    );
    expect(screen.getByText('8GB GDDR6 · 550W')).toBeInTheDocument();
    expect(screen.getByText(/7\.990\.000 đồng/)).toBeInTheDocument();
    expect(screen.getByText('Còn hàng')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Thêm ${gpu.name} vào giỏ` })).toBeEnabled();
  });

  it('hết hàng: nhãn "Hết hàng", nút vô hiệu, vẫn mở được trang chi tiết', () => {
    renderCard({ ...gpu, stock: 0 });
    expect(screen.getByRole('button', { name: 'Hết hàng' })).toBeDisabled();
    expect(screen.getAllByText('Hết hàng')).toHaveLength(2); // nhãn trên ảnh + nút
    expect(screen.getByRole('link', { name: gpu.name })).toHaveAttribute(
      'href',
      '/products/p-gpu-1',
    );
  });

  it('không có specs: dòng thông số rỗng nhưng vẫn giữ chỗ', () => {
    const { container } = renderCard({ ...gpu, specs: undefined });
    const heading = screen.getByRole('heading', { level: 3 });
    const specsLine = heading.nextElementSibling;
    expect(specsLine?.tagName).toBe('P');
    expect(specsLine).toBeEmptyDOMElement();
    expect(container.querySelectorAll('article p').length).toBe(2); // hãng + dòng thông số
  });
});
