import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import {
  getCurrentUserId,
  notifyAuthChanged,
  onAuthChange,
  onOtherTabAuthChange,
} from '../../../shared/auth/token';
import { clearSessionData, isSignedInOnly } from './sessionData';

/**
 * Đổi người đăng nhập ở tab khác cùng trình duyệt (#508). Phiên Cognito nằm trong cookie dùng chung
 * mọi tab nên đổi ở tab kia thì mọi lệnh API của tab này đã chạy bằng token mới; tab này phải dọn dữ
 * liệu của người trước và hiện đúng người đang đăng nhập.
 *
 * So người bằng `sub` (UserProfile.userId), không bằng email (threat model L14).
 */

/** Câu báo ở đầu `/cart` khi tab đang đặt hàng thì tab khác đổi sang người khác */
export const ACCOUNT_SWITCHED_NOTICE =
  'Tài khoản đăng nhập vừa đổi ở tab khác nên đơn đang đặt dở chưa được gửi. Hãy kiểm tra lại giỏ hàng trước khi đặt.';

/** Câu dự phòng ở `/checkout`: tải lại xong vẫn lệch người, không tự tải lại nữa */
export const ACCOUNT_SWITCH_FALLBACK =
  'Tài khoản vừa đổi ở tab khác. Tải lại trang để đặt hàng bằng tài khoản đang đăng nhập.';

/** Cờ cho `/cart` hiện câu báo một lần ở đúng tab bị đổi (sessionStorage là của riêng tab) */
const NOTICE_KEY = 'shop-ai:account-switched-notice';
/** Cờ chống tải lại vòng: `sub` mà lần tải lại vừa rồi muốn tới */
const RELOAD_KEY = 'shop-ai:auth-reload';

/** Người tab này đang hiện; undefined khi chưa đọc xong lần đầu. Dùng chung cho hook và chốt chặn đặt hàng */
let shownUserId: string | null | undefined;
/** Tải lại xong mà phiên vẫn không phải người muốn tới: không tự tải lại nữa trong tab này */
let reloadBlocked = false;

/** Tải lại trang; tách ra để test thay được */
export const pageReload = { reload: () => window.location.reload() };

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSession(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // trình duyệt chặn sessionStorage: mất câu báo hoặc cờ chống vòng, không hỏng trang
  }
}

/** Có câu báo đổi tài khoản chờ `/cart` hiện không (chỉ đọc, gọi nhiều lần không mất cờ) */
export function peekAccountSwitchedNotice(): boolean {
  return readSession(NOTICE_KEY) !== null;
}

/** `/cart` gọi sau khi đã hiện câu báo: trả true nếu còn cờ và xoá cờ (F5 không hiện lại) */
export function takeAccountSwitchedNotice(): boolean {
  if (readSession(NOTICE_KEY) === null) return false;
  writeSession(NOTICE_KEY, null);
  return true;
}

/** Chỉ cho test: trả trạng thái của module về như lúc mở trang */
export function resetCrossTabSessionForTests() {
  shownUserId = undefined;
  reloadBlocked = false;
}

/**
 * Ghi nhận người tab này đang hiện lúc mở trang. Vừa tải lại vì tab khác đổi người mà phiên vẫn không
 * phải người muốn tới thì không tự tải lại nữa trong tab này (chống vòng tải lại)
 */
function recordShownUser(current: string | null) {
  if (shownUserId === undefined) shownUserId = current;
  const target = readSession(RELOAD_KEY);
  if (target !== null) {
    writeSession(RELOAD_KEY, null);
    if (target !== current) reloadBlocked = true;
  }
}

const isCheckout = (path: string) => path === '/checkout' || path.startsWith('/checkout/');

/**
 * Xử lý khi người đăng nhập đã đổi so với người tab này đang hiện. Không gọi signOut() của Cognito,
 * không gửi tin cho tab khác (tránh các tab báo qua báo lại).
 * - Nay là khách (tab kia đăng xuất): dọn như bấm Đăng xuất ở tab này; trang bắt buộc đăng nhập thì về `/`.
 * - Người khác, đang ở `/checkout`: dọn (gồm mục đặt dở), không tải lại `/checkout`, sang `/cart` kèm câu báo.
 * - Người khác, trang thường: dọn rồi tải lại trang đang xem; tải lại rồi vẫn lệch thì không tải nữa.
 */
function applyAccountSwitch(
  current: string | null,
  path: string,
  queryClient: QueryClient,
  navigate: NavigateFunction,
) {
  shownUserId = current;
  clearSessionData(queryClient);
  if (current === null) {
    notifyAuthChanged();
    if (isSignedInOnly(path)) navigate('/', { replace: true });
    return;
  }
  if (isCheckout(path)) {
    writeSession(NOTICE_KEY, '1');
    notifyAuthChanged();
    navigate('/cart', { replace: true });
    return;
  }
  if (reloadBlocked) {
    notifyAuthChanged();
    return;
  }
  writeSession(RELOAD_KEY, current);
  pageReload.reload();
}

/**
 * Gắn một lần ở gốc app (RootLayout). Kiểm lại người đang đăng nhập khi tab khác báo đã đăng nhập hoặc
 * đăng xuất (BroadcastChannel, kể cả khi tab này đang ẩn) và khi tab này được mở lại (visibilitychange,
 * phòng lỡ tin hoặc trình duyệt không có BroadcastChannel). Cùng người thì không làm gì.
 */
export function useCrossTabSession() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pathRef = useRef(pathname);
  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    // Lần đầu: ghi nhận người tab này hiện (và xét cờ chống tải lại vòng)
    void getCurrentUserId().then(
      (current) => {
        if (!cancelled) recordShownUser(current);
      },
      () => undefined,
    );

    const check = async () => {
      if (shownUserId === undefined) return;
      let current: string | null;
      try {
        current = await getCurrentUserId();
      } catch {
        return;
      }
      if (cancelled || current === shownUserId) return;
      applyAccountSwitch(current, pathRef.current, queryClient, navigate);
    };

    const offOtherTab = onOtherTabAuthChange(() => void check());
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    // Phiên đổi ngay trong tab này: chỉ ghi nhận người mới, không coi là tab khác đổi. Phiên hết hạn
    // hoặc bị thu hồi mà khách không bấm gì (Hub báo tokenRefresh_failure, signedOut) thì dọn dữ liệu
    // của người vừa dùng; không chuyển trang, không tải lại (trang bắt buộc đăng nhập tự xử lý)
    const offThisTab = onAuthChange(() => {
      void getCurrentUserId().then(
        (current) => {
          if (cancelled) return;
          if (shownUserId && current === null) clearSessionData(queryClient);
          shownUserId = current;
        },
        () => undefined,
      );
    });

    return () => {
      cancelled = true;
      offOtherTab();
      offThisTab();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queryClient, navigate]);
}

/** Kết quả chốt chặn trước khi gửi đơn */
export type OrderGuardResult = 'ok' | 'switched' | 'stuck';

/**
 * Chốt chặn ngay trước `POST /orders` (#508): đọc lại `sub` của phiên, khác người trang đang hiện thì
 * không gửi đơn và xử lý như ca `/checkout` (dọn, sang `/cart` kèm câu báo). Đã từng tải lại mà vẫn lệch
 * thì trả 'stuck' để trang hiện câu dự phòng, không tự chuyển trang.
 */
export function useOrderAccountGuard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Trang đặt hàng mở ra: ghi nhận người đang hiện nếu gốc app chưa ghi (vd. test chỉ vẽ trang này)
  useEffect(() => {
    if (shownUserId !== undefined) return;
    void getCurrentUserId().then(recordShownUser, () => undefined);
  }, []);

  return useCallback(async (): Promise<OrderGuardResult> => {
    const current = await getCurrentUserId();
    // Chưa ghi nhận người đang hiện (vừa mở trang): coi người trong phiên là người đang hiện
    if (shownUserId === undefined) shownUserId = current;
    if (current === shownUserId) return 'ok';
    if (reloadBlocked && current !== null) return 'stuck';
    applyAccountSwitch(current, pathname, queryClient, navigate);
    return 'switched';
  }, [queryClient, navigate, pathname]);
}
