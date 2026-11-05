// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import {
  CART_TARGET_ATTR,
  flyToCart,
  getFlights,
  landFlight,
  setFlightLayerReady,
} from '../lib/flyToCart';
import { CartBadge } from './CartBadge';

const badge = () => screen.queryByTestId('cart-badge');

/** Một ô bay đang chạy (nút và icon giỏ giả, đủ để flyToCart nhận) */
function startFlight() {
  const from = document.createElement('button');
  const cart = document.createElement('a');
  cart.setAttribute(CART_TARGET_ATTR, '');
  document.body.append(from, cart);
  const box = { left: 0, top: 0, width: 40, height: 40 } as DOMRect;
  vi.spyOn(from, 'getBoundingClientRect').mockReturnValue(box);
  vi.spyOn(cart, 'getBoundingClientRect').mockReturnValue(box);
  document.elementFromPoint = vi.fn(() => cart);
  setFlightLayerReady(true);
  expect(flyToCart(from, 'gpu')).toBe(true);
  const flights = getFlights();
  return flights[flights.length - 1]!.id;
}

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  for (const flight of getFlights()) landFlight(flight.id);
  setFlightLayerReady(false);
  for (const el of document.querySelectorAll(`[${CART_TARGET_ATTR}], body > button`)) el.remove();
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('CartBadge', () => {
  it('0 thì không có nhãn; có số thì hiện số, chỉ để nhìn (aria-hidden)', () => {
    const { rerender } = render(<CartBadge count={0} />);
    expect(badge()).toBeNull();

    rerender(<CartBadge count={3} />);
    act(() => vi.runOnlyPendingTimers());
    expect(badge()).toHaveTextContent('3');
    expect(badge()).toHaveAttribute('aria-hidden', 'true');
  });

  it('không có ô bay (giảm chuyển động, giỏ đổi ở tab khác): số đổi ngay', () => {
    const { rerender } = render(<CartBadge count={1} />);
    rerender(<CartBadge count={2} />);
    act(() => vi.runOnlyPendingTimers());
    expect(badge()).toHaveTextContent('2');
  });

  it('đang có ô bay: giữ số cũ, ô tới nơi mới hiện số mới', () => {
    const { rerender } = render(<CartBadge count={1} />);

    const id = startFlight();
    rerender(<CartBadge count={2} />);
    act(() => vi.runOnlyPendingTimers());
    expect(badge()).toHaveTextContent('1');

    act(() => landFlight(id));
    expect(badge()).toHaveTextContent('2');
  });

  it('giỏ trống mà ô đang bay: nhãn chỉ hiện khi ô tới nơi', () => {
    const { rerender } = render(<CartBadge count={0} />);
    const id = startFlight();
    rerender(<CartBadge count={1} />);
    act(() => vi.runOnlyPendingTimers());
    expect(badge()).toBeNull();

    act(() => landFlight(id));
    expect(badge()).toHaveTextContent('1');
  });

  it('đăng xuất (số về 0): nhãn mất ngay', () => {
    const { rerender } = render(<CartBadge count={4} />);
    rerender(<CartBadge count={0} />);
    act(() => vi.runOnlyPendingTimers());
    expect(badge()).toBeNull();
  });
});
