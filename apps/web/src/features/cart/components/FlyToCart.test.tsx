// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render } from '@testing-library/react';
import {
  CART_TARGET_ATTR,
  flyToCart,
  getFlights,
  landFlight,
  onFlightLanded,
} from '../lib/flyToCart';
import { FlyToCart } from './FlyToCart';

/** Web Animations giả: test tự quyết lúc animation xong */
let finishAll: () => void;
beforeEach(() => {
  const pending: Array<() => void> = [];
  finishAll = () => pending.splice(0).forEach((done) => done());
  HTMLElement.prototype.animate = vi.fn(() => {
    const finished = new Promise<void>((resolve) => pending.push(resolve));
    return { finished, cancel: vi.fn() } as unknown as Animation;
  });
  window.matchMedia = (() => ({ matches: false })) as unknown as typeof window.matchMedia;
});
afterEach(() => {
  for (const flight of getFlights()) landFlight(flight.id);
  for (const el of document.querySelectorAll(`[${CART_TARGET_ATTR}], body > button`)) el.remove();
  cleanup();
  vi.restoreAllMocks();
  Reflect.deleteProperty(HTMLElement.prototype, 'animate');
});

function start() {
  const from = document.createElement('button');
  const cart = document.createElement('a');
  cart.setAttribute(CART_TARGET_ATTR, '');
  document.body.append(from, cart);
  const box = { left: 0, top: 0, width: 40, height: 40 } as DOMRect;
  vi.spyOn(from, 'getBoundingClientRect').mockReturnValue(box);
  vi.spyOn(cart, 'getBoundingClientRect').mockReturnValue(box);
  document.elementFromPoint = vi.fn(() => cart);
  act(() => {
    flyToCart(from, 'gpu');
  });
}

describe('FlyToCart', () => {
  it('vẽ ô bay vào body (aria-hidden, có icon loại hàng), animation xong thì báo tới nơi và gỡ ô', async () => {
    const landed = vi.fn();
    const stop = onFlightLanded(landed);
    render(<FlyToCart />);

    start();
    const flying = document.body.querySelector('[aria-hidden="true"] svg');
    expect(flying).not.toBeNull();
    expect(landed).not.toHaveBeenCalled();

    await act(async () => finishAll());

    expect(landed).toHaveBeenCalledTimes(1);
    expect(getFlights()).toHaveLength(0);
    stop();
  });
});
