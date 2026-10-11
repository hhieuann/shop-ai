import { useCallback, useSyncExternalStore } from 'react';

/** Mốc máy tính của header, menu danh mục, menu tài khoản (design-system §9.1) */
export const DESKTOP_QUERY = '(min-width: 1280px)';

/** true khi media query khớp; tự cập nhật khi đổi cỡ cửa sổ */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
