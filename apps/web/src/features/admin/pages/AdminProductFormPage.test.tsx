// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';
import { FakeXhr } from '../lib/fakeXhr';
import { AdminProductFormPage } from './AdminProductFormPage';

const UPDATED_AT = '2026-11-20T03:15:00.000Z';
const PRODUCT = {
  productId: '01J9XKPQ0000000000000001',
  name: 'Card MSI RTX 4060 Ventus 2X 8GB',
  category: 'gpu',
  brand: 'MSI',
  price: 8_290_000,
  stock: 12,
  status: 'ACTIVE',
  description: 'Card tầm trung cho 1080p.',
  specs: { vram: '8GB GDDR6', nguon_de_xuat: '550W' },
  createdAt: '2026-10-01T07:00:00.000Z',
  updatedAt: UPDATED_AT,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status < 400 ? 'application/json' : 'application/problem+json' },
  });

/** Trả lời theo method; GET chi tiết mặc định trả PRODUCT */
let getResponse: (url: string) => Response;
let writeResponse: () => Response;
const respond = async (url: string, init?: RequestInit) =>
  (init?.method ?? 'GET') === 'GET' ? getResponse(url) : writeResponse();
const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(respond);
const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);
const bodyOf = (method: string, index = 0) =>
  JSON.parse(String(calls(method)[index]?.[1]?.body)) as Record<string, unknown>;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
    this.open = false;
  };
});

beforeEach(() => {
  getResponse = () => json(PRODUCT);
  writeResponse = () => json(PRODUCT);
  // Test "đang lưu" thay cách trả lời: đặt lại cho mỗi test
  fetchMock.mockReset().mockImplementation(respond);
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

function renderAt(path: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/admin/products/new', element: <AdminProductFormPage /> },
      { path: '/admin/products/:productId/edit', element: <AdminProductFormPage /> },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), router };
}

const field = (name: string | RegExp) => screen.getByRole('textbox', { name });
const save = () => screen.getByRole('button', { name: /Lưu sản phẩm|Đang lưu/ });

describe('AdminProductFormPage · thêm (pages/admin-san-pham.md mục 3)', () => {
  it('new_preselectsCategoryFromUrl_andFillsTemplate', async () => {
    // Act
    renderAt('/admin/products/new?category=gpu');

    // Assert: chip Card đồ hoạ chọn sẵn, dải "Đã điền mẫu", tên giá tồn kho trống
    expect(await screen.findByRole('radio', { name: 'Card đồ hoạ' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByText(/Đã điền mẫu Card đồ hoạ/)).toBeInTheDocument();
    expect(field(/Tên sản phẩm/)).toHaveValue('');
    expect(field(/Giá bán/)).toHaveValue('');
    expect(field(/Hãng/)).toHaveValue('MSI');
    expect(field('VRAM')).toHaveValue('8GB GDDR6');
  });

  it('clearTemplate_emptiesFields', async () => {
    // Arrange
    const { user } = renderAt('/admin/products/new?category=gpu');
    await screen.findByText(/Đã điền mẫu/);

    // Act
    await user.click(screen.getByRole('button', { name: 'Xoá mẫu' }));

    // Assert
    expect(field(/Hãng/)).toHaveValue('');
    expect(field('VRAM')).toHaveValue('');
    expect(screen.queryByText(/Đã điền mẫu/)).toBeNull();
  });

  it('changeCategory_afterEditing_asksFirst', async () => {
    // Arrange
    const { user } = renderAt('/admin/products/new?category=gpu');
    await user.type(await screen.findByRole('textbox', { name: /Tên sản phẩm/ }), 'Card A');

    // Act
    await user.click(screen.getByRole('radio', { name: 'Chuột' }));

    // Assert: hỏi lại; "Giữ loại cũ" giữ nguyên
    const dialog = screen.getByRole('dialog', { name: 'Đổi loại hàng?' });
    await user.click(within(dialog).getByRole('button', { name: 'Giữ loại cũ' }));
    expect(screen.getByRole('radio', { name: 'Card đồ hoạ' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(field(/Tên sản phẩm/)).toHaveValue('Card A');

    // Act: đổi thật
    await user.click(screen.getByRole('radio', { name: 'Chuột' }));
    await user.click(screen.getByRole('button', { name: 'Đổi loại' }));

    // Assert: mẫu chuột
    expect(screen.getByRole('radio', { name: 'Chuột' })).toHaveAttribute('aria-checked', 'true');
    expect(field(/Tên sản phẩm/)).toHaveValue('');
    expect(field('DPI')).toBeInTheDocument();
  });

  it('save_withEmptyRequired_showsFieldErrors_andSendsNothing', async () => {
    // Arrange
    const { user } = renderAt('/admin/products/new?category=gpu');
    await screen.findByText(/Đã điền mẫu/);

    // Act
    await user.click(save());

    // Assert
    expect(screen.getByText('Nhập tên sản phẩm.')).toBeInTheDocument();
    expect(screen.getByText('Nhập giá bán.')).toBeInTheDocument();
    expect(field(/Tên sản phẩm/)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Kiểm lại các ô đánh dấu đỏ.');
    // Verify
    expect(calls('POST')).toHaveLength(0);
  });

  it('save_postsBody_thenGoesToEditPage_withToast', async () => {
    // Arrange
    writeResponse = () =>
      json({ ...PRODUCT, productId: '01J9XKPQ0000000000000099', name: 'Card A' }, 201);
    const { user, router } = renderAt('/admin/products/new?category=gpu');
    await user.type(await screen.findByRole('textbox', { name: /Tên sản phẩm/ }), 'Card A');
    await user.type(field(/Giá bán/), '8290000');
    await user.type(field(/Tồn kho/), '5');

    // Act
    await user.click(save());

    // Assert: POST đúng body; sang trang sửa của món mới kèm Toast
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/products/01J9XKPQ0000000000000099/edit'),
    );
    expect(bodyOf('POST')).toMatchObject({
      name: 'Card A',
      category: 'gpu',
      brand: 'MSI',
      price: 8_290_000,
      stock: 5,
      status: 'ACTIVE',
    });
    expect(await screen.findByText('Đã thêm "Card A".')).toBeInTheDocument();
  });

  it('save_mapsApi400ErrorsToFields_includingSpecs', async () => {
    // Arrange
    writeResponse = () =>
      json(
        {
          title: 'Bad Request',
          status: 400,
          errors: [
            { field: 'name', message: 'name dài 1–150 ký tự' },
            { field: 'specs.vram', message: 'Khoá không thuộc loại hàng' },
          ],
        },
        400,
      );
    const { user } = renderAt('/admin/products/new?category=gpu');
    await user.type(await screen.findByRole('textbox', { name: /Tên sản phẩm/ }), 'Card A');
    await user.type(field(/Giá bán/), '1000');
    await user.type(field(/Tồn kho/), '1');

    // Act
    await user.click(save());

    // Assert
    expect(await screen.findByText('Khoá không thuộc loại hàng')).toBeInTheDocument();
    expect(field('VRAM')).toHaveAttribute('aria-invalid', 'true');
    expect(field(/Tên sản phẩm/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('saving_locksSubmitButton', async () => {
    // Arrange: API chưa trả lời
    fetchMock.mockImplementation(async (url, init) =>
      (init?.method ?? 'GET') === 'GET' ? getResponse(url) : new Promise<Response>(() => {}),
    );
    const { user } = renderAt('/admin/products/new?category=gpu');
    await user.type(await screen.findByRole('textbox', { name: /Tên sản phẩm/ }), 'Card A');
    await user.type(field(/Giá bán/), '1000');
    await user.type(field(/Tồn kho/), '1');

    // Act
    await user.click(save());

    // Assert: nút đổi "Đang lưu…", bấm lại không gửi thêm
    expect(await screen.findByRole('button', { name: 'Đang lưu…' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    await user.click(save());
    expect(calls('POST')).toHaveLength(1);
  });

  it('from_copiesProduct_exceptNamePriceStockImage', async () => {
    // Act
    renderAt(`/admin/products/new?from=${PRODUCT.productId}`);

    // Assert
    expect(
      await screen.findByText(`Đã sao chép từ "${PRODUCT.name}". Nhập tên, giá, tồn kho và ảnh.`),
    ).toBeInTheDocument();
    expect(field(/Tên sản phẩm/)).toHaveValue('');
    expect(field(/Giá bán/)).toHaveValue('');
    expect(field(/Hãng/)).toHaveValue('MSI');
    expect(field('VRAM')).toHaveValue('8GB GDDR6');
  });

  it('leavingWithUnsavedChanges_asksFirst', async () => {
    // Arrange
    const { user, router } = renderAt('/admin/products/new?category=gpu');
    await user.type(await screen.findByRole('textbox', { name: /Tên sản phẩm/ }), 'Card A');

    // Act
    await user.click(screen.getByRole('link', { name: 'Huỷ' }));

    // Assert: hỏi lại; "Ở lại" giữ trang
    const dialog = await screen.findByRole('dialog', { name: 'Rời trang?' });
    await user.click(within(dialog).getByRole('button', { name: 'Ở lại' }));
    expect(router.state.location.pathname).toBe('/admin/products/new');

    // Act: rời thật
    await user.click(screen.getByRole('link', { name: 'Huỷ' }));
    await user.click(await screen.findByRole('button', { name: 'Rời trang' }));

    // Assert
    expect(router.state.location.pathname).toBe('/admin/products');
  });

  it('toastSitsAboveSaveBar_whileFormIsOpen_andResetsAfterLeaving', async () => {
    // Arrange: thanh "Lưu sản phẩm" dính đáy; thông báo nổi phải đứng trên thanh (không che nút Lưu)
    const { router } = renderAt('/admin/products/new?category=gpu');
    await screen.findByText(/Đã điền mẫu/);
    const offset = () => document.documentElement.style.getPropertyValue('--toast-offset-bottom');

    // Assert: trang mở thì có biến (jsdom đo chiều cao 0px)
    expect(offset()).toMatch(/^\d+px$/);

    // Act: rời trang
    await router.navigate('/admin/products');

    // Assert: các trang khác giữ khoảng cách mặc định
    await waitFor(() => expect(offset()).toBe(''));
  });
});

describe('AdminProductFormPage · sửa (BR-12)', () => {
  const editPath = `/admin/products/${PRODUCT.productId}/edit`;

  it('edit_loadsProduct_categoryNotEditable', async () => {
    // Act
    renderAt(editPath);

    // Assert
    expect(
      await screen.findByRole('heading', { level: 1, name: PRODUCT.name }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Loại hàng' })).toBeNull();
    expect(screen.getByText(/Loại hàng không đổi được/)).toBeInTheDocument();
    expect(field(/Giá bán/)).toHaveValue('8290000');
  });

  it('save_patchesOnlyChangedFields_withUpdatedAtAndExpectedStock', async () => {
    // Arrange
    writeResponse = () => json({ ...PRODUCT, stock: 20, updatedAt: '2026-11-25T09:00:00.000Z' });
    const { user } = renderAt(editPath);
    const stock = await screen.findByRole('textbox', { name: /Tồn kho/ });

    // Act
    await user.clear(stock);
    await user.type(stock, '20');
    await user.click(save());

    // Assert
    expect(await screen.findByText('Đã lưu thay đổi.')).toBeInTheDocument();
    expect(calls('PATCH')[0]?.[0]).toBe(`/api/v1/admin/products/${PRODUCT.productId}`);
    expect(bodyOf('PATCH')).toEqual({ updatedAt: UPDATED_AT, stock: 20, expectedStock: 12 });
  });

  it('stockChanged409_showsCurrentStockOnStockField_andNextSaveUsesIt', async () => {
    // Arrange
    writeResponse = () =>
      json({ title: 'Conflict', status: 409, code: 'STOCK_CHANGED', currentStock: 10 }, 409);
    const { user } = renderAt(editPath);
    const stock = await screen.findByRole('textbox', { name: /Tồn kho/ });
    await user.clear(stock);
    await user.type(stock, '20');

    // Act
    await user.click(save());

    // Assert
    expect(await screen.findByText(/Tồn kho vừa đổi thành 10/)).toBeInTheDocument();
    expect(field(/Tồn kho/)).toHaveAttribute('aria-invalid', 'true');

    // Act: lưu lại thì expectedStock là 10
    writeResponse = () => json({ ...PRODUCT, stock: 20 });
    await user.click(save());

    // Assert
    await screen.findByText('Đã lưu thay đổi.');
    expect(bodyOf('PATCH', 1)).toMatchObject({ stock: 20, expectedStock: 10 });
  });

  it('productChanged409_showsWarningWithLoadLatest', async () => {
    // Arrange
    const latest = { ...PRODUCT, price: 7_990_000, updatedAt: '2026-11-25T09:00:00.000Z' };
    writeResponse = () =>
      json({ title: 'Conflict', status: 409, code: 'PRODUCT_CHANGED', current: latest }, 409);
    const { user } = renderAt(editPath);
    const price = await screen.findByRole('textbox', { name: /Giá bán/ });
    await user.clear(price);
    await user.type(price, '9000000');
    getResponse = () => json(latest);

    // Act
    await user.click(save());

    // Assert
    expect(await screen.findByText(/Sản phẩm vừa được sửa ở nơi khác/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Nạp bản mới' }));
    expect(field(/Giá bán/)).toHaveValue('7990000');
    expect(screen.queryByText(/Sản phẩm vừa được sửa ở nơi khác/)).toBeNull();
  });

  it('deletedProduct_locksForm_andRestoreUnlocks', async () => {
    // Arrange
    getResponse = () =>
      json({ ...PRODUCT, status: 'INACTIVE', deletedAt: '2026-11-24T08:00:00.000Z' });
    writeResponse = () => json({ ...PRODUCT, status: 'INACTIVE' });
    const { user } = renderAt(editPath);

    // Assert: dải đã xoá, form khoá
    expect(await screen.findByText(/Sản phẩm này đã bị xoá/)).toBeInTheDocument();
    expect(field(/Tên sản phẩm/)).toBeDisabled();
    expect(save()).toBeDisabled();

    // Act
    await user.click(screen.getByRole('button', { name: 'Khôi phục' }));

    // Assert
    expect(await screen.findByText(/Đã khôi phục/)).toBeInTheDocument();
    expect(calls('POST')[0]?.[0]).toBe(`/api/v1/admin/products/${PRODUCT.productId}/restore`);
    expect(field(/Tên sản phẩm/)).not.toBeDisabled();
  });

  it.each([
    [404, 'Không tìm thấy sản phẩm.'],
    [403, 'Bạn không có quyền xem trang này.'],
  ])('load%s_showsMessage', async (status, message) => {
    // Arrange
    getResponse = () => json({ title: 'Error', status }, status);

    // Act
    renderAt(editPath);

    // Assert
    expect(await screen.findByText(message)).toBeInTheDocument();
  });
});

describe('AdminProductFormPage · ảnh (BR-16, #562)', () => {
  const editPath = `/admin/products/${PRODUCT.productId}/edit`;
  const UPLOADED =
    'https://d111111abcdef8.cloudfront.net/images/products/01KAB3Q5G00000000000000001.jpg';

  beforeEach(() => {
    FakeXhr.reset();
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
  });

  it('edit_removeImageThenSave_sendsImageUrlNull', async () => {
    // Arrange: món đang có ảnh trong bucket
    getResponse = () => json({ ...PRODUCT, imageUrl: UPLOADED });
    writeResponse = () => json({ ...PRODUCT, updatedAt: '2026-11-26T09:00:00.000Z' });
    const { user } = renderAt(editPath);

    // Act
    await user.click(await screen.findByRole('button', { name: 'Bỏ ảnh này' }));
    await user.click(save());

    // Assert
    expect(await screen.findByText('Đã lưu thay đổi.')).toBeInTheDocument();
    expect(bodyOf('PATCH')).toEqual({ updatedAt: UPDATED_AT, imageUrl: null });
  });

  it('new_uploadingLocksSave_thenUploadedUrlIsSent', async () => {
    // Arrange
    writeResponse = () =>
      json({
        upload: { url: 'https://bucket.s3.ap-southeast-1.amazonaws.com/', fields: { key: 'k' } },
        imageUrl: UPLOADED,
        expiresAt: '2026-11-26T05:05:00.000Z',
      });
    const { user } = renderAt('/admin/products/new?category=gpu');
    await screen.findByText(/Đã điền mẫu/);
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;

    // Act
    await user.upload(input, new File([new Uint8Array(10)], 'a.png', { type: 'image/png' }));
    await waitFor(() => expect(FakeXhr.last()).toBeDefined());

    // Assert: đang tải thì không lưu được, có câu nói lý do
    expect(save()).toBeDisabled();
    expect(screen.getByText('Chờ tải ảnh xong rồi lưu.')).toBeInTheDocument();

    // Act: S3 nhận tệp
    await act(async () => FakeXhr.last()!.respond(204));

    // Assert
    await waitFor(() => expect(save()).toBeEnabled());
    expect(screen.queryByText('Chờ tải ảnh xong rồi lưu.')).toBeNull();
    expect(calls('POST')[0]?.[0]).toBe('/api/v1/admin/product-images');
  });
});
