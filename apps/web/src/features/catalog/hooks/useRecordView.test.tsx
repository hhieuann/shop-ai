// @vitest-environment jsdom
import { StrictMode, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { SessionStatus } from '../../../shared/auth/useSession';
import { useRecordView } from './useRecordView';

const recordEvent = vi.fn();
vi.mock('../../../shared/api/events', () => ({
  recordEvent: (...args: unknown[]) => recordEvent(...args),
}));

let session: SessionStatus = 'signedIn';
vi.mock('../../../shared/auth/useSession', () => ({ useSession: () => session }));

beforeEach(() => {
  recordEvent.mockClear();
  session = 'signedIn';
});

describe('useRecordView', () => {
  it('đã đăng nhập: gửi VIEW một lần, tải lại dữ liệu cùng sản phẩm không gửi thêm', () => {
    // Act
    const { rerender } = renderHook(({ id }: { id: string | undefined }) => useRecordView(id), {
      initialProps: { id: 'p-1' },
    });
    rerender({ id: 'p-1' });

    // Verify
    expect(recordEvent).toHaveBeenCalledExactlyOnceWith('p-1', 'VIEW');
  });

  it('StrictMode (effect chạy hai lần ở dev) vẫn chỉ gửi một lần', () => {
    renderHook(() => useRecordView('p-1'), {
      wrapper: ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>,
    });
    expect(recordEvent).toHaveBeenCalledTimes(1);
  });

  it('khách chưa đăng nhập thì không gửi', () => {
    session = 'guest';
    renderHook(() => useRecordView('p-1'));
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('chưa có sản phẩm (đang tải, 404, lỗi) thì không gửi', () => {
    renderHook(() => useRecordView(undefined));
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it('phiên đang đọc thì chờ, biết đã đăng nhập mới gửi', () => {
    session = 'loading';
    const { rerender } = renderHook(() => useRecordView('p-1'));
    expect(recordEvent).not.toHaveBeenCalled();

    session = 'signedIn';
    rerender();
    expect(recordEvent).toHaveBeenCalledExactlyOnceWith('p-1', 'VIEW');
  });

  it('đổi sang sản phẩm khác thì gửi tiếp cho sản phẩm đó', () => {
    const { rerender } = renderHook(({ id }: { id: string }) => useRecordView(id), {
      initialProps: { id: 'p-1' },
    });
    rerender({ id: 'p-2' });

    expect(recordEvent.mock.calls).toEqual([
      ['p-1', 'VIEW'],
      ['p-2', 'VIEW'],
    ]);
  });
});
