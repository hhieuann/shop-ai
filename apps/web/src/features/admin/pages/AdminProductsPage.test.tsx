// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AdminProductsPage } from './AdminProductsPage';

const UPDATED_AT = '2026-11-20T03:15:00.000Z';
const product = (overrides: Record<string, unknown> = {}) => ({
  productId: '01J9XKPQ0000000000000001',
  name: 'Laptop Lenovo Legion 5',
  category: 'laptop',
  brand: 'Lenovo',
  price: 36_990_000,
  stock: 12,
  status: 'ACTIVE',
  description: 'Laptop chơi game.',
  createdAt: '2026-10-01T07:00:00.000Z',
  updatedAt: UPDATED_AT,
  ...overrides,
});
const ACTIVE = product();
const LOW = product({
  productId: '01J9XKPQ0000000000000002',
  name: 'Laptop MSI Modern 14',
  stock: 2,
});
const HIDDEN = product({
  productId: '01J9XKPQ0000000000000003',
  name: 'Laptop Acer Aspire 7',
  stock: 0,
  status: 'INACTIVE',
});
const DELETED = product({
  productId: '01J9XKPQ0000000000000004',
  name: 'Laptop Dell Vostro',
  status: 'INACTIVE',
  deletedAt: '2026-11-24T08:00:00.000Z',
});
const COUNTS = { active: 7, inactive: 1, deleted: 2 };

const json = (body: unknown, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      'content-type': status < 400 ? 'application/json' : 'application/problem+json',
    },
  });

let listResponse: () => Response | Promise<Response>;
let writeResponse: () => Response;
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(
  async (_url, init) => ((init?.method ?? 'GET') === 'GET' ? listResponse() : writeResponse()),
);
const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);

beforeAll(() => {
  // jsdom chưa có showModal, close của <dialog>
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

beforeEach(() => {
  listResponse = () => json({ items: [ACTIVE, LOW, HIDDEN], counts: COUNTS });
  writeResponse = () => json(ACTIVE);
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

function renderAt(
  path = '/admin/products',
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } }),
) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/admin/products"
            element={
              <>
                <AdminProductsPage />
                <Where />
              </>
            }
          />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const row = (name: string) => screen.getByText(name).closest('tr') as HTMLElement;

describe('AdminProductsPage · danh sách (pages/admin-san-pham.md mục 2)', () => {
  it('loading_showsMessage_untilListArrives', async () => {
    // Arrange: API chưa trả lời
    listResponse = () => new Promise<Response>(() => {});

    // Act
    renderAt();

    // Assert
    expect(await screen.findByText('Đang tải sản phẩm…')).toBeInTheDocument();
  });

  it('list_readsLaptopByDefault_andShowsRowsStockAndCounts', async () => {
    // Act
    renderAt();

    // Assert
    expect(await screen.findByText(ACTIVE.name)).toBeInTheDocument();
    expect(String(calls('GET')[0]?.[0])).toBe('/api/v1/admin/products?category=laptop&limit=20');
    // Tồn kho từ 3 trở xuống cảnh báo, 0 là "Hết hàng"; nhãn trạng thái
    expect(within(row(LOW.name)).getByText('2').className).toMatch(/low/);
    expect(within(row(HIDDEN.name)).getByText('Hết hàng')).toBeInTheDocument();
    expect(within(row(HIDDEN.name)).getByText('Đã ẩn')).toBeInTheDocument();
    expect(within(row(ACTIVE.name)).getByText('Đang bán')).toBeInTheDocument();
    // Nút phân đoạn có số đếm (Tất cả = đang bán + đã ẩn), "Tất cả" đang chọn
    const segments = screen.getByRole('navigation', { name: 'Trạng thái sản phẩm' });
    expect(within(segments).getByRole('link', { name: 'Tất cả 8' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(segments).getByRole('link', { name: 'Đã xoá 2' })).toBeInTheDocument();
    // Nút Sửa trỏ trang sửa (#549)
    expect(
      within(row(ACTIVE.name)).getByRole('link', { name: `Sửa: ${ACTIVE.name}` }),
    ).toHaveAttribute('href', `/admin/products/${ACTIVE.productId}/edit`);
  });

  it('filtersFromUrl_areSentToApi_andShownSelected', async () => {
    // Act
    renderAt('/admin/products?category=gpu&status=INACTIVE&q=rtx');

    // Assert
    await screen.findByText(ACTIVE.name);
    expect(String(calls('GET')[0]?.[0])).toBe(
      '/api/v1/admin/products?category=gpu&limit=20&status=INACTIVE&q=rtx',
    );
    expect(screen.getByRole('combobox', { name: 'Loại hàng' })).toHaveValue('gpu');
    expect(screen.getByRole('searchbox', { name: 'Tìm sản phẩm theo tên' })).toHaveValue('rtx');
    expect(screen.getByRole('link', { name: 'Đã ẩn 1' })).toHaveAttribute('aria-current', 'page');
  });

  it('changeCategoryOrSegment_updatesUrl', async () => {
    // Arrange
    const user = userEvent.setup();
    renderAt('/admin/products?status=ACTIVE');
    await screen.findByText(ACTIVE.name);

    // Act: đổi loại thì giữ trạng thái đang lọc
    await user.selectOptions(screen.getByRole('combobox', { name: 'Loại hàng' }), 'mouse');

    // Assert
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/admin/products?category=mouse&status=ACTIVE',
    );

    // Act: chọn "Đã xoá"
    await user.click(screen.getByRole('link', { name: /^Đã xoá/ }));

    // Assert
    expect(screen.getByTestId('where')).toHaveTextContent(
      '/admin/products?category=mouse&status=DELETED',
    );
  });

  it('search_updatesUrlAfterTypingPause', async () => {
    // Arrange
    const user = userEvent.setup();
    renderAt();
    await screen.findByText(ACTIVE.name);

    // Act
    await user.type(screen.getByRole('searchbox', { name: 'Tìm sản phẩm theo tên' }), 'legion');

    // Assert: chờ ngừng gõ 300 ms rồi mới đổi URL
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/admin/products?q=legion'),
    );
  });

  it('search_keepsFocusAndText_whileTypingAfterUrlUpdates', async () => {
    // Arrange
    const user = userEvent.setup();
    renderAt();
    await screen.findByText(ACTIVE.name);
    const box = screen.getByRole('searchbox', { name: 'Tìm sản phẩm theo tên' });

    // Act: gõ, chờ URL đổi (ngừng gõ 300 ms), gõ tiếp
    await user.type(box, 'leg');
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/admin/products?q=leg'),
    );
    await user.type(screen.getByRole('searchbox', { name: 'Tìm sản phẩm theo tên' }), 'ion');

    // Assert: vẫn là ô cũ, giữ focus, đủ chữ (review #558)
    const after = screen.getByRole('searchbox', { name: 'Tìm sản phẩm theo tên' });
    expect(after).toBe(box);
    expect(after).toHaveFocus();
    expect(after).toHaveValue('legion');
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/admin/products?q=legion'),
    );
  });

  it('search_showsUrlKeyword_afterBrowserBack', async () => {
    // Arrange: lịch sử có hai từ khoá, đang ở từ khoá sau
    const user = userEvent.setup();
    function Back() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate(-1)}>
          Quay lại
        </button>
      );
    }
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter
          initialEntries={['/admin/products?q=acer', '/admin/products?q=dell']}
          initialIndex={1}
        >
          <Routes>
            <Route
              path="/admin/products"
              element={
                <>
                  <AdminProductsPage />
                  <Back />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    const box = await screen.findByRole('searchbox', { name: 'Tìm sản phẩm theo tên' });
    expect(box).toHaveValue('dell');

    // Act
    await user.click(screen.getByRole('button', { name: 'Quay lại' }));

    // Assert: ô ra từ khoá cũ của URL
    await waitFor(() =>
      expect(screen.getByRole('searchbox', { name: 'Tìm sản phẩm theo tên' })).toHaveValue('acer'),
    );
  });

  it('emptyLaterPage_goesBackToFirstPage_keepingFilters', async () => {
    // Arrange: trang 2 rỗng (vd. vừa xoá món cuối của trang)
    listResponse = () => json({ items: [], counts: COUNTS });

    // Act
    renderAt('/admin/products?status=INACTIVE&cursor=abc&page=2');

    // Assert: về trang 1 cùng bộ lọc, không báo "chưa có sản phẩm" ở trang 2
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(/^\/admin\/products\?status=INACTIVE$/),
    );
  });

  it.each([
    ['loại không có món', '/admin/products', 'Chưa có sản phẩm nào trong loại này.'],
    ['tìm không thấy', '/admin/products?q=xyz', 'Không có sản phẩm khớp "xyz".'],
    ['lọc đã xoá', '/admin/products?status=DELETED', 'Chưa xoá sản phẩm nào.'],
  ])('empty_showsMessage_when_%s', async (_name, path, message) => {
    // Arrange
    listResponse = () => json({ items: [], counts: COUNTS });

    // Act
    renderAt(path);

    // Assert
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('loadError_showsAlert', async () => {
    // Arrange
    listResponse = () => json({ title: 'Internal Server Error', status: 500 }, 500);

    // Act
    renderAt();

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được danh sách sản phẩm. Tải lại trang để thử lần nữa.',
    );
  });

  it('forbidden403_showsNoPermission', async () => {
    // Arrange
    listResponse = () => json({ title: 'Forbidden', status: 403, code: 'FORBIDDEN' }, 403);

    // Act
    renderAt();

    // Assert
    expect(await screen.findByText('Bạn không có quyền xem trang này.')).toBeInTheDocument();
  });
});

describe('AdminProductsPage · thao tác (BR-13, BR-14)', () => {
  async function openMenu(user: ReturnType<typeof userEvent.setup>, name: string) {
    await screen.findByText(name);
    await user.click(within(row(name)).getByRole('button', { name: `Thao tác khác: ${name}` }));
  }

  it('hide_patchesStatusWithUpdatedAt_showsToast_andReloads', async () => {
    // Arrange
    const user = userEvent.setup();
    renderAt();
    await openMenu(user, ACTIVE.name);

    // Act
    await user.click(screen.getByRole('menuitem', { name: 'Ẩn khỏi cửa hàng' }));

    // Assert
    expect(await screen.findByText(`Đã ẩn "${ACTIVE.name}" khỏi cửa hàng.`)).toBeInTheDocument();
    // Verify: PATCH đúng món, gửi updatedAt đang thấy; tải lại danh sách
    const [url, init] = calls('PATCH')[0] ?? [];
    expect(url).toBe(`/api/v1/admin/products/${ACTIVE.productId}`);
    expect(JSON.parse(String(init?.body))).toEqual({ updatedAt: UPDATED_AT, status: 'INACTIVE' });
    await waitFor(() => expect(calls('GET').length).toBe(2));
  });

  it('show_patchesActive_forHiddenProduct', async () => {
    // Arrange
    const user = userEvent.setup();
    renderAt();
    await openMenu(user, HIDDEN.name);

    // Act
    await user.click(screen.getByRole('menuitem', { name: 'Hiện lại' }));

    // Assert
    expect(await screen.findByText(`Đã hiện lại "${HIDDEN.name}".`)).toBeInTheDocument();
    expect(JSON.parse(String(calls('PATCH')[0]?.[1]?.body))).toMatchObject({ status: 'ACTIVE' });
  });

  it('delete_asksFirst_keepDoesNothing_confirmDeletes', async () => {
    // Arrange
    const user = userEvent.setup();
    writeResponse = () => json(null, 204);
    renderAt();
    await openMenu(user, ACTIVE.name);

    // Act: chọn Xoá thì hỏi lại
    await user.click(screen.getByRole('menuitem', { name: 'Xoá' }));

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Xoá sản phẩm này?' });
    expect(dialog).toHaveTextContent(ACTIVE.name);

    // Act: "Giữ lại" không xoá
    await user.click(within(dialog).getByRole('button', { name: 'Giữ lại' }));

    // Verify
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(calls('DELETE')).toHaveLength(0);

    // Act: xoá thật
    await openMenu(user, ACTIVE.name);
    await user.click(screen.getByRole('menuitem', { name: 'Xoá' }));
    await user.click(screen.getByRole('button', { name: 'Xoá sản phẩm' }));

    // Assert
    expect(await screen.findByText(`Đã xoá "${ACTIVE.name}".`)).toBeInTheDocument();
    expect(calls('DELETE')[0]?.[0]).toBe(`/api/v1/admin/products/${ACTIVE.productId}`);
  });

  it('deletedRow_hasOnlyRestore_andRestorePosts', async () => {
    // Arrange
    const user = userEvent.setup();
    listResponse = () => json({ items: [DELETED], counts: COUNTS });
    writeResponse = () => json({ ...DELETED, deletedAt: undefined });
    renderAt('/admin/products?status=DELETED');
    await screen.findByText(DELETED.name);

    // Assert: dòng đã xoá không có Sửa, không có menu
    const deletedRow = row(DELETED.name);
    expect(within(deletedRow).getByText('Đã xoá')).toBeInTheDocument();
    expect(within(deletedRow).queryByRole('link', { name: /Sửa/ })).toBeNull();
    expect(within(deletedRow).queryByRole('button', { name: /Thao tác khác/ })).toBeNull();

    // Act
    await user.click(
      within(deletedRow).getByRole('button', { name: `Khôi phục: ${DELETED.name}` }),
    );

    // Assert
    expect(
      await screen.findByText(`Đã khôi phục "${DELETED.name}". Sản phẩm đang ở trạng thái đã ẩn.`),
    ).toBeInTheDocument();
    expect(calls('POST')[0]?.[0]).toBe(`/api/v1/admin/products/${DELETED.productId}/restore`);
  });

  it('restore_putsReturnedProductIntoDetailCache', async () => {
    // Arrange: cache chi tiết còn bản đã xoá (trang sửa từng mở)
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const detailKey = ['admin', 'products', 'detail', DELETED.productId];
    queryClient.setQueryData(detailKey, DELETED);
    const restored = { ...DELETED, deletedAt: undefined, updatedAt: '2026-11-27T09:00:00.000Z' };
    listResponse = () => json({ items: [DELETED], counts: COUNTS });
    writeResponse = () => json(restored);
    renderAt('/admin/products?status=DELETED', queryClient);
    await screen.findByText(DELETED.name);

    // Act
    await user.click(
      within(row(DELETED.name)).getByRole('button', { name: `Khôi phục: ${DELETED.name}` }),
    );

    // Assert: trang sửa mở ngay sau đó dùng bản vừa khôi phục (review #559)
    await waitFor(() => expect(queryClient.getQueryData(detailKey)).toEqual(restored));
  });

  it('conflict409_tellsChangedElsewhere_andReloads', async () => {
    // Arrange
    const user = userEvent.setup();
    writeResponse = () =>
      json({ title: 'Conflict', status: 409, code: 'PRODUCT_CHANGED', current: ACTIVE }, 409);
    renderAt();
    await openMenu(user, ACTIVE.name);

    // Act
    await user.click(screen.getByRole('menuitem', { name: 'Ẩn khỏi cửa hàng' }));

    // Assert
    expect(
      await screen.findByText('Sản phẩm vừa được sửa ở nơi khác. Danh sách đã được tải lại.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(calls('GET').length).toBe(2));
  });

  it('notFound404_tellsMissing_andReloads', async () => {
    // Arrange
    const user = userEvent.setup();
    writeResponse = () => json({ title: 'Not Found', status: 404 }, 404);
    renderAt();
    await openMenu(user, ACTIVE.name);

    // Act
    await user.click(screen.getByRole('menuitem', { name: 'Ẩn khỏi cửa hàng' }));

    // Assert
    expect(
      await screen.findByText('Không tìm thấy sản phẩm. Danh sách đã được tải lại.'),
    ).toBeInTheDocument();
  });

  it('forbidden403OnWrite_showsNoPermission', async () => {
    // Arrange
    const user = userEvent.setup();
    writeResponse = () => json({ title: 'Forbidden', status: 403, code: 'FORBIDDEN' }, 403);
    renderAt();
    await openMenu(user, ACTIVE.name);

    // Act
    await user.click(screen.getByRole('menuitem', { name: 'Ẩn khỏi cửa hàng' }));

    // Assert
    expect(await screen.findByText('Bạn không có quyền xem trang này.')).toBeInTheDocument();
  });

  it('duplicate_goesToNewPageWithFrom', async () => {
    // Arrange
    const user = userEvent.setup();
    renderAt();
    await openMenu(user, ACTIVE.name);

    // Act
    await user.click(screen.getByRole('menuitem', { name: 'Nhân bản' }));

    // Assert
    expect(screen.getByTestId('where')).toHaveTextContent(
      `/admin/products/new?from=${ACTIVE.productId}`,
    );
  });
});
