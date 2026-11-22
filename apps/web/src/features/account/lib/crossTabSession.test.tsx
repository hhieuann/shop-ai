// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { queryKeys } from '../../../shared/api/queryKeys';
import {
  announceAuthChanged,
  notifyAuthChanged,
  onOtherTabAuthChange,
  signOut,
} from '../../../shared/auth/token';
import { loadCheckoutItems, saveCheckoutItems } from '../../orders/lib/checkoutStorage';
import {
  pageReload,
  resetCrossTabSessionForTests,
  takeAccountSwitchedNotice,
  useCrossTabSession,
  useOrderAccountGuard,
  type OrderGuardResult,
} from './crossTabSession';

// Người trong phiên (cookie dùng chung) do test đổi; tin từ tab khác do test bắn qua `otherTabMessage`
let currentUserId: string | null;
let otherTabListener: (() => void) | null;

vi.mock('../../../shared/auth/token', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../shared/auth/token')>();
  return {
    ...actual,
    getCurrentUserId: vi.fn(async () => currentUserId),
    onOtherTabAuthChange: vi.fn((listener: () => void) => {
      otherTabListener = listener;
      return () => {
        otherTabListener = null;
      };
    }),
    announceAuthChanged: vi.fn(),
    signOut: vi.fn(),
    notifyAuthChanged: vi.fn(actual.notifyAuthChanged),
  };
});

const ITEMS = [{ productId: 'p-1', name: 'Laptop', price: 20_000_000, quantity: 1 }];

let guardResult: OrderGuardResult | null;

function Probe() {
  useCrossTabSession();
  const guard = useOrderAccountGuard();
  const { pathname } = useLocation();
  return (
    <>
      <p data-testid="where">{pathname}</p>
      <button type="button" onClick={() => void guard().then((r) => (guardResult = r))}>
        Kiểm trước khi đặt
      </button>
    </>
  );
}

function renderAt(path: string) {
  const queryClient = new QueryClient();
  queryClient.setQueryData(queryKeys.orders.all, ['đơn của A']);
  queryClient.setQueryData(queryKeys.recs.all, ['gợi ý của A']);
  queryClient.setQueryData(queryKeys.cart.all, ['giỏ của A']);
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return queryClient;
}

/** Chờ hook ghi nhận người đang hiện lần đầu */
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

/** Tab khác gửi tin đã đăng nhập / đăng xuất */
async function otherTabMessage() {
  await act(async () => {
    otherTabListener?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => state === 'hidden' });
}

const cleared = (queryClient: QueryClient) =>
  queryClient.getQueryData(queryKeys.orders.all) === undefined &&
  queryClient.getQueryData(queryKeys.recs.all) === undefined &&
  queryClient.getQueryData(queryKeys.cart.all) === undefined;

let reloadSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  resetCrossTabSessionForTests();
  currentUserId = 'sub-a';
  otherTabListener = null;
  guardResult = null;
  setVisibility('visible');
  vi.mocked(announceAuthChanged).mockClear();
  vi.mocked(signOut).mockClear();
  vi.mocked(notifyAuthChanged).mockClear();
  reloadSpy = vi.spyOn(pageReload, 'reload').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  reloadSpy.mockRestore();
});

describe('useCrossTabSession (#508)', () => {
  it('otherTabSignsInAnotherPerson_onNormalPage_clearsAndReloads', async () => {
    // Arrange: tab này đang hiện A ở trang danh sách
    const queryClient = renderAt('/products');
    await settle();

    // Act: tab khác đăng nhập B
    currentUserId = 'sub-b';
    await otherTabMessage();

    // Assert: dọn dữ liệu của A rồi tải lại trang đang xem
    expect(cleared(queryClient)).toBe(true);
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('where')).toHaveTextContent('/products');
    // Verify: tab nhận tin không đăng xuất Cognito, không gửi lại tin
    expect(signOut).not.toHaveBeenCalled();
    expect(announceAuthChanged).not.toHaveBeenCalled();
  });

  it('otherTabSignsOut_clearsLikeSignOut_goesHomeFromOrders_withoutSignOutOrMessage', async () => {
    // Arrange
    saveCheckoutItems(ITEMS);
    localStorage.setItem('shop-ai:guest-cart', JSON.stringify([{ productId: 'p-1', quantity: 1 }]));
    const queryClient = renderAt('/orders');
    await settle();

    // Act: tab khác chỉ đăng xuất
    currentUserId = null;
    await otherTabMessage();

    // Assert: như bấm Đăng xuất ở tab này: dọn giỏ, mục đặt dở, đơn, gợi ý; trang bắt buộc đăng nhập về /
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent(/^\/$/));
    expect(cleared(queryClient)).toBe(true);
    expect(loadCheckoutItems()).toEqual([]);
    expect(localStorage.getItem('shop-ai:guest-cart')).toBeNull();
    expect(notifyAuthChanged).toHaveBeenCalled();
    // Verify: không tải lại, không gọi signOut() của Cognito, không gửi tin
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(announceAuthChanged).not.toHaveBeenCalled();
  });

  it('otherTabSignsOut_onNormalPage_staysWithoutReload', async () => {
    // Arrange
    renderAt('/products');
    await settle();

    // Act
    currentUserId = null;
    await otherTabMessage();

    // Assert: trang thường không bắt buộc đăng nhập: ở lại, không tải lại
    expect(screen.getByTestId('where')).toHaveTextContent('/products');
    expect(reloadSpy).not.toHaveBeenCalled();
  });

  it('hiddenTabOnCheckout_goesToCartWithNoticeOnce_withoutReloadingCheckout', async () => {
    // Arrange: tab đang ở trang đặt hàng của A, đang ẩn
    saveCheckoutItems(ITEMS);
    const queryClient = renderAt('/checkout');
    await settle();
    setVisibility('hidden');

    // Act: tab khác đăng nhập B
    currentUserId = 'sub-b';
    await otherTabMessage();

    // Assert: dọn (gồm mục đặt dở), sang /cart, không tải lại /checkout
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/cart'));
    expect(cleared(queryClient)).toBe(true);
    expect(loadCheckoutItems()).toEqual([]);
    expect(reloadSpy).not.toHaveBeenCalled();
    // Câu báo ở /cart: chỉ một lần (lần sau, vd. F5, không còn)
    expect(takeAccountSwitchedNotice()).toBe(true);
    expect(takeAccountSwitchedNotice()).toBe(false);
  });

  it('samePersonSignsInAgain_doesNothing', async () => {
    // Arrange
    const queryClient = renderAt('/products');
    await settle();

    // Act: tab khác đăng xuất rồi đăng nhập lại đúng A; tin tới khi phiên đã là A
    await otherTabMessage();

    // Assert: không tải lại, không dọn
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(cleared(queryClient)).toBe(false);
    expect(queryClient.getQueryData(queryKeys.orders.all)).toEqual(['đơn của A']);
  });

  it('withoutBroadcastChannel_checksWhenTabBecomesVisible', async () => {
    // Arrange: trình duyệt không có BroadcastChannel thì không có tin nào tới
    vi.mocked(onOtherTabAuthChange).mockImplementationOnce(() => () => undefined);
    renderAt('/products');
    await settle();
    currentUserId = 'sub-b';

    // Act: quay lại tab
    await act(async () => {
      setVisibility('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Assert
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('signInInThisTab_isNotTreatedAsOtherTab', async () => {
    // Arrange: tab này là khách
    currentUserId = null;
    const queryClient = renderAt('/products');
    await settle();

    // Act: đăng nhập ngay trong tab này (trang đăng nhập gọi notifyAuthChanged), rồi quay lại tab
    currentUserId = 'sub-a';
    await act(async () => {
      notifyAuthChanged();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Assert: không coi là tab khác đổi người
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(cleared(queryClient)).toBe(false);
  });

  it('sessionExpiredInThisTab_clearsData_withoutReloadMessageOrSignOut', async () => {
    // Arrange: tab này đang hiện A
    const queryClient = renderAt('/products');
    await settle();

    // Act: phiên hết hạn hoặc bị thu hồi ngay trong tab này (Hub báo, khách không bấm gì), không có
    // tin từ tab khác
    currentUserId = null;
    await act(async () => {
      notifyAuthChanged();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    // Assert: dữ liệu của A đã dọn, ở nguyên trang
    expect(cleared(queryClient)).toBe(true);
    expect(screen.getByTestId('where')).toHaveTextContent('/products');
    // Verify: không tải lại, không gửi tin, không gọi signOut()
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(announceAuthChanged).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('reloadedButStillMismatched_doesNotReloadAgain', async () => {
    // Arrange: lần tải lại trước muốn tới B nhưng phiên sau khi tải lại là C
    sessionStorage.setItem('shop-ai:auth-reload', 'sub-b');
    currentUserId = 'sub-c';
    renderAt('/products');
    await settle();

    // Act: lại có tin đổi người
    currentUserId = 'sub-d';
    await otherTabMessage();

    // Assert: không tải lại nữa (chống vòng), chỉ báo để header đọc lại
    expect(reloadSpy).not.toHaveBeenCalled();
    expect(notifyAuthChanged).toHaveBeenCalled();
  });

  it('reloadedToExpectedPerson_clearsFlag_andCanReloadLater', async () => {
    // Arrange: lần tải lại trước tới đúng B
    sessionStorage.setItem('shop-ai:auth-reload', 'sub-b');
    currentUserId = 'sub-b';
    renderAt('/products');
    await settle();

    // Assert: cờ đã xoá
    expect(sessionStorage.getItem('shop-ai:auth-reload')).toBeNull();

    // Act: lần đổi người sau vẫn tải lại bình thường
    currentUserId = 'sub-c';
    await otherTabMessage();

    // Assert
    expect(reloadSpy).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('shop-ai:auth-reload')).toBe('sub-c');
  });
});

describe('useOrderAccountGuard (#508)', () => {
  it('samePerson_isOk', async () => {
    // Arrange
    renderAt('/checkout');
    await settle();

    // Act
    await act(async () => screen.getByRole('button', { name: 'Kiểm trước khi đặt' }).click());

    // Assert
    await waitFor(() => expect(guardResult).toBe('ok'));
    expect(screen.getByTestId('where')).toHaveTextContent('/checkout');
  });

  it('otherPersonInSession_isSwitched_andGoesToCart', async () => {
    // Arrange: tin giữa các tab bị lỡ, tab vẫn hiện A
    vi.mocked(onOtherTabAuthChange).mockImplementationOnce(() => () => undefined);
    saveCheckoutItems(ITEMS);
    renderAt('/checkout');
    await settle();
    currentUserId = 'sub-b';

    // Act: bấm đặt hàng
    await act(async () => screen.getByRole('button', { name: 'Kiểm trước khi đặt' }).click());

    // Assert: không cho gửi, xử lý như ca /checkout
    await waitFor(() => expect(guardResult).toBe('switched'));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/cart'));
    expect(loadCheckoutItems()).toEqual([]);
    expect(takeAccountSwitchedNotice()).toBe(true);
  });

  it('reloadBlocked_isStuck_andStaysOnCheckout', async () => {
    // Arrange: đã tải lại mà vẫn lệch
    vi.mocked(onOtherTabAuthChange).mockImplementationOnce(() => () => undefined);
    sessionStorage.setItem('shop-ai:auth-reload', 'sub-b');
    currentUserId = 'sub-c';
    renderAt('/checkout');
    await settle();
    currentUserId = 'sub-d';

    // Act
    await act(async () => screen.getByRole('button', { name: 'Kiểm trước khi đặt' }).click());

    // Assert: trang hiện câu dự phòng, không tự chuyển
    await waitFor(() => expect(guardResult).toBe('stuck'));
    expect(screen.getByTestId('where')).toHaveTextContent('/checkout');
  });
});
