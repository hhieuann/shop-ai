// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { shouldRetry } from '../../../shared/api/retry';
import type { Product } from '../../../shared/api/types';
import { ProductDetailPage } from './ProductDetailPage';

vi.mock('../../cart/hooks/useCart', () => ({
  useCart: () => ({
    items: [],
    status: 'ready',
    add: { isPending: false, isSuccess: false, isError: false, mutate: vi.fn() },
  }),
}));

const ID = '01K8GQ5Z3XM2T9V4B6N8P0R2S4';
const GPU: Product = {
  productId: ID,
  name: 'Card đồ hoạ ASUS TUF RTX 4070 SUPER 12GB',
  brand: 'ASUS',
  category: 'gpu',
  price: 17_990_000,
  stock: 12,
  status: 'ACTIVE',
  description: 'Card đồ hoạ 12GB GDDR6X.',
  specs: { vram: '12GB GDDR6X', nguon_de_xuat: '650W' },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
};

/** API giả: chi tiết sản phẩm theo `reply`, gợi ý mua kèm luôn rỗng */
let reply: () => Response;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
const fetchMock = vi.fn(async (url: string) =>
  url.includes('/recs/') ? json({ items: [], source: 'BESTSELLER' }) : reply(),
);

beforeEach(() => {
  reply = () => json(GPU);
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Mặc định dùng đúng luật gọi lại của app (main.tsx). Lỗi 5xx được gọi lại sau độ trễ,
 * nên ca lỗi 500 truyền `retry: false` để test không phải chờ.
 */
function renderPage({ retry = shouldRetry }: { retry?: typeof shouldRetry | false } = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/products/${ID}`]}>
        <Routes>
          <Route path="/products/:productId" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProductDetailPage', () => {
  it('đường dẫn Trang chủ › Card đồ hoạ › tên, đúng một h1, link loại tới trang lọc', async () => {
    renderPage();
    const heading = await screen.findByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(GPU.name);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);

    const crumb = screen.getByRole('navigation', { name: 'Đường dẫn' });
    const items = within(crumb).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['Trang chủ', 'Card đồ hoạ', GPU.name]);
    expect(within(items[1]!).getByRole('link')).toHaveAttribute('href', '/products?category=gpu');
    expect(within(items[2]!).getByText(GPU.name)).toHaveAttribute('aria-current', 'page');
  });

  it('hộp mua có giá, tồn kho, giao hàng miễn phí và COD', async () => {
    renderPage();
    const buy = await screen.findByRole('complementary', { name: 'Mua hàng' });
    expect(buy).toHaveTextContent('Còn hàng');
    expect(buy).toHaveTextContent('Giao hàng miễn phí');
    expect(buy).toHaveTextContent('Thanh toán khi nhận hàng (COD)');
    expect(within(buy).getByRole('button', { name: 'Thêm vào giỏ' })).toBeInTheDocument();
  });

  it('có thông số thì có khối "Thông số kỹ thuật", không có thì không', async () => {
    renderPage();
    const specHeading = await screen.findByRole('heading', { name: 'Thông số kỹ thuật' });
    // Trong DOM hộp mua đứng trước khối thông số (thứ tự đọc dưới 960 khớp thứ tự nhìn)
    const buy = screen.getByRole('complementary', { name: 'Mua hàng' });
    expect(
      buy.compareDocumentPosition(specHeading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    cleanup();

    reply = () => json({ ...GPU, specs: undefined });
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('heading', { name: 'Thông số kỹ thuật' })).toBeNull();
  });

  it('không có ảnh thì hiện icon loại hàng; có ảnh thì ảnh có alt là tên, không lazy', async () => {
    renderPage();
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('img')).toBeNull();
    cleanup();

    reply = () => json({ ...GPU, imageUrl: 'https://example.com/rtx.png' });
    renderPage();
    const img = await screen.findByRole('img', { name: GPU.name });
    expect(img).not.toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('width', '560');
  });

  it('hết hàng: nhãn "Hết hàng", không có bộ chọn số lượng, nút vô hiệu', async () => {
    reply = () => json({ ...GPU, stock: 0 });
    renderPage();
    const buy = await screen.findByRole('complementary', { name: 'Mua hàng' });
    expect(within(buy).getAllByText('Hết hàng').length).toBeGreaterThan(0);
    expect(within(buy).queryByText('Số lượng')).toBeNull();
    expect(within(buy).getByRole('button', { name: 'Hết hàng' })).toBeDisabled();
  });

  it('tồn kho thấp: nhãn "Chỉ còn 3"', async () => {
    reply = () => json({ ...GPU, stock: 3 });
    renderPage();
    expect(await screen.findByText('Chỉ còn 3')).toBeInTheDocument();
  });

  it('404: đường dẫn chỉ có Trang chủ, câu báo và link xem tất cả sản phẩm', async () => {
    reply = () => json({ status: 404, title: 'Not Found' }, 404);
    renderPage();
    expect(await screen.findByText('Sản phẩm không tồn tại hoặc đã bị gỡ.')).toBeInTheDocument();
    const crumb = screen.getByRole('navigation', { name: 'Đường dẫn' });
    expect(within(crumb).getAllByRole('listitem')).toHaveLength(1);
    expect(within(crumb).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Xem tất cả sản phẩm' })).toHaveAttribute(
      'href',
      '/products',
    );
    // Dùng shouldRetry của app: 404 không gọi lại, chỉ gọi API chi tiết một lần
    expect(fetchMock.mock.calls.filter(([url]) => !url.includes('/recs/'))).toHaveLength(1);
  });

  it('lỗi tải khác: báo bằng role="alert"', async () => {
    reply = () => json({ status: 500, title: 'Error' }, 500);
    renderPage({ retry: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được sản phẩm. Tải lại trang để thử lần nữa.',
    );
  });

  it('đang tải: khung chờ đúng bố cục, có aria-busy', () => {
    // API chi tiết không bao giờ trả lời: trang ở trạng thái đang tải
    fetchMock.mockImplementationOnce(() => new Promise<Response>(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });
});
