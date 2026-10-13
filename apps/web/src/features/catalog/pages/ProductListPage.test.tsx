// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, type InitialEntry } from 'react-router-dom';
import { ProductListPage } from './ProductListPage';

vi.mock('../../cart/hooks/useCart', () => ({
  useCart: () => ({ add: { isPending: false, mutate: vi.fn() } }),
}));

/** jsdom không có matchMedia: điều khiển bản máy tính (≥1280) hay điện thoại bằng biến này */
let desktop = true;
/** Ít thẻ mỗi trang cho test nhanh (CI chậm hơn máy nhiều lần); trang chỉ đi theo nextCursor */
const TOTAL = 10;
const PAGE_SIZE = 4;

function product(i: number, category: string) {
  return {
    productId: `p-${category}-${i}`,
    name: `Sản phẩm ${category} ${i}`,
    category,
    brand: 'Hãng',
    price: 1_000_000 + i,
    stock: 10,
    status: 'ACTIVE',
  };
}

/** API giả: 10 sản phẩm, 4 mỗi trang, cursor "c<vị trí>"; vài từ khoá đặc biệt để tạo lỗi */
const fetchMock = vi.fn(async (url: string) => {
  const params = new URL(url, 'http://test').searchParams;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (params.get('q') === 'loi') return json({ status: 500, title: 'Error' }, 500);
  if (params.get('cursor') === 'hong') return json({ status: 400, title: 'Bad Request' }, 400);
  if (params.get('q') === 'khongco') return json({ items: [], nextCursor: null });
  const category = params.get('category') ?? 'gpu';
  const start = Number((params.get('cursor') ?? 'c0').slice(1));
  const items = Array.from({ length: Math.min(PAGE_SIZE, TOTAL - start) }, (_, k) =>
    product(start + k, category),
  );
  return json({ items, nextCursor: start + PAGE_SIZE < TOTAL ? `c${start + PAGE_SIZE}` : null });
});

beforeAll(() => {
  window.matchMedia = ((query: string) => ({
    matches: desktop,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  })) as unknown as typeof window.matchMedia;
});
beforeEach(() => {
  desktop = true;
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
  window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="url">{`${location.pathname}${location.search}`}</p>;
}

function renderAt(entry: InitialEntry) {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/products"
            element={
              <>
                <ProductListPage />
                <CurrentLocation />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const url = () => screen.getByTestId('url').textContent;
const lastRequest = () => new URL(String(fetchMock.mock.lastCall?.[0]), 'http://test');

describe('ProductListPage', () => {
  it('không lọc: tiêu đề, đường dẫn, tên tab "Tất cả sản phẩm"; thẻ của trang 1', async () => {
    renderAt('/products');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tất cả sản phẩm');
    const crumbs = screen.getByRole('navigation', { name: 'Đường dẫn' });
    expect(within(crumbs).getByRole('link', { name: 'Trang chủ' })).toHaveAttribute('href', '/');
    expect(within(crumbs).getByText('Tất cả sản phẩm')).toHaveAttribute('aria-current', 'page');
    expect(await screen.findAllByRole('article')).toHaveLength(PAGE_SIZE);
    expect(screen.getByText('Trang 1')).toHaveAttribute('aria-current', 'page');
    expect(document.title).toBe('Tất cả sản phẩm | Black Magic');
    expect(lastRequest().search).toBe('?limit=20');
  });

  it('tìm trong một loại: "Kết quả cho “rtx”", dòng "Trong mục …", gửi q và category', async () => {
    renderAt('/products?q=rtx&category=gpu');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Kết quả cho “rtx”');
    expect(screen.getByText('Trong mục Card đồ hoạ')).toBeInTheDocument();
    expect(
      within(screen.getByRole('navigation', { name: 'Đường dẫn' })).getByText('Tìm kiếm “rtx”'),
    ).toBeInTheDocument();
    await screen.findAllByRole('article');
    expect(lastRequest().searchParams.get('q')).toBe('rtx');
    expect(lastRequest().searchParams.get('category')).toBe('gpu');
  });

  it('Sau: sang trang 2 theo nextCursor, cuộn lên và focus tiêu đề; Trước: về trang 1', async () => {
    const user = userEvent.setup();
    renderAt('/products?category=gpu');
    await screen.findAllByRole('article');

    await user.click(screen.getByRole('link', { name: 'Trang sau' }));

    expect(url()).toBe('/products?category=gpu&cursor=c4&page=2');
    expect(await screen.findByText('Trang 2')).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1 })).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalled();
    expect(document.title).toBe('Card đồ hoạ – Trang 2 | Black Magic');
    await waitFor(() => expect(lastRequest().searchParams.get('cursor')).toBe('c4'));

    await user.click(screen.getByRole('link', { name: 'Trang trước' }));

    expect(url()).toBe('/products?category=gpu');
    expect(await screen.findByText('Trang 1')).toBeInTheDocument();
  });

  it('Sau tới trang 3 rồi Trước: về đúng trang 2 nhờ cursor giữ trong state', async () => {
    const user = userEvent.setup();
    renderAt('/products');
    await screen.findAllByRole('article');
    await user.click(screen.getByRole('link', { name: 'Trang sau' }));
    await screen.findByText('Trang 2');
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Trang sau' })).toHaveAttribute(
        'href',
        '/products?cursor=c8&page=3',
      ),
    );
    await user.click(screen.getByRole('link', { name: 'Trang sau' }));
    await screen.findByText('Trang 3');

    // Trang cuối: hết nextCursor thì "Sau" vô hiệu
    await waitFor(() =>
      expect(screen.getByRole('link', { name: 'Trang sau' })).toHaveAttribute(
        'aria-disabled',
        'true',
      ),
    );
    await user.click(screen.getByRole('link', { name: 'Trang trước' }));

    expect(url()).toBe('/products?cursor=c4&page=2');
  });

  it('mở link trang 3 ở tab mới (không có state): Trước về trang 1', async () => {
    renderAt('/products?cursor=c8&page=3');

    await screen.findAllByRole('article');
    expect(screen.getByText('Trang 3')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Trang trước' })).toHaveAttribute('href', '/products');
  });

  it('đổi loại ở cột lọc khi đang ở trang 2: về trang 1 của loại đó, giữ cách sắp xếp', async () => {
    const user = userEvent.setup();
    renderAt('/products?sort=price_asc&cursor=c4&page=2');
    await screen.findAllByRole('article');

    const panel = screen.getByRole('complementary', { name: 'Bộ lọc' });
    await user.click(within(panel).getByText('Chuột'));

    expect(url()).toBe('/products?sort=price_asc&category=mouse');
  });

  it('đổi sắp xếp ở select về trang 1; chọn "Mới nhất" thì bỏ sort khỏi URL', async () => {
    const user = userEvent.setup();
    renderAt('/products?category=gpu&cursor=c4&page=2');
    await screen.findAllByRole('article');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sắp xếp' }), 'price_desc');
    expect(url()).toBe('/products?category=gpu&sort=price_desc');

    await user.click(screen.getByRole('button', { name: 'Mới nhất' }));
    expect(url()).toBe('/products?category=gpu');
    expect(screen.getByRole('button', { name: 'Mới nhất' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('cursor trên URL hỏng (API trả 400): tự về trang 1, không báo lỗi', async () => {
    renderAt('/products?category=gpu&cursor=hong&page=4');

    await waitFor(() => expect(url()).toBe('/products?category=gpu'));
    expect(await screen.findAllByRole('article')).toHaveLength(PAGE_SIZE);
    expect(screen.queryByText(/Chưa tải được sản phẩm/)).toBeNull();
  });

  it('tìm không ra: câu báo, link xem tất cả, không có sắp xếp và chuyển trang', async () => {
    renderAt('/products?q=khongco');

    expect(
      await screen.findByText('Không có sản phẩm nào có “khongco” trong tên.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem tất cả sản phẩm' })).toHaveAttribute(
      'href',
      '/products',
    );
    expect(screen.queryByRole('group', { name: 'Sắp xếp' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Phân trang' })).toBeNull();
  });

  it('API lỗi: báo lỗi role="alert"', async () => {
    renderAt('/products?q=loi');

    const message = await screen.findByText(/Chưa tải được sản phẩm/);
    expect(message).toHaveAttribute('role', 'alert');
  });

  it('điện thoại: nút "Lọc" có số bộ lọc, mở bảng lọc, áp dụng thì đổi loại và về trang 1', async () => {
    desktop = false;
    const user = userEvent.setup();
    renderAt('/products?category=gpu&cursor=c4&page=2');
    await screen.findAllByRole('article');

    const filter = screen.getByRole('button', { name: 'Lọc, 1 bộ lọc đang chọn' });
    expect(filter).toHaveAttribute('aria-haspopup', 'dialog');
    await user.click(filter);
    const sheet = screen.getByRole('dialog', { name: 'Bộ lọc tìm kiếm' });
    await user.click(within(sheet).getByText('Chuột'));
    await user.click(within(sheet).getByRole('button', { name: 'Áp dụng bộ lọc' }));

    expect(url()).toBe('/products?category=mouse');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
