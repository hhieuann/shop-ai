// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CART_TARGET_ATTR,
  flyToCart,
  getFlights,
  hasFlights,
  landFlight,
  onFlightLanded,
  setFlightLayerReady,
} from './flyToCart';

let reduced = false;
const rect = (x: number, y: number, size = 40) =>
  ({ left: x, top: y, width: size, height: size }) as DOMRect;

let button: HTMLButtonElement;
let cart: HTMLAnchorElement;

beforeEach(() => {
  reduced = false;
  setFlightLayerReady(true);
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('reduce'),
  })) as unknown as typeof window.matchMedia;
  button = document.createElement('button');
  cart = document.createElement('a');
  cart.setAttribute(CART_TARGET_ATTR, '');
  document.body.append(button, cart);
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue(rect(100, 500));
  vi.spyOn(cart, 'getBoundingClientRect').mockReturnValue(rect(900, 10));
  // Điểm giữa icon giỏ không bị gì phủ lên
  document.elementFromPoint = vi.fn(() => cart);
});
afterEach(() => {
  for (const flight of getFlights()) landFlight(flight.id);
  button.remove();
  cart.remove();
  vi.restoreAllMocks();
});

describe('flyToCart', () => {
  it('icon giỏ thấy được: thêm một ô bay từ tâm nút tới tâm icon giỏ, mang loại hàng', () => {
    expect(flyToCart(button, 'gpu')).toBe(true);

    expect(getFlights()).toEqual([
      expect.objectContaining({ category: 'gpu', from: { x: 120, y: 520 }, to: { x: 920, y: 30 } }),
    ]);
    expect(hasFlights()).toBe(true);
  });

  it('bấm nhiều lần thì mỗi lần một ô', () => {
    flyToCart(button, 'gpu');
    flyToCart(button, 'gpu');
    expect(getFlights()).toHaveLength(2);
  });

  it('lớp vẽ ô bay chưa tải xong (hoặc tải lỗi): không bay', () => {
    setFlightLayerReady(false);
    expect(flyToCart(button, 'gpu')).toBe(false);
    expect(hasFlights()).toBe(false);
  });

  it('bật giảm chuyển động: không bay', () => {
    reduced = true;
    expect(flyToCart(button, 'gpu')).toBe(false);
    expect(hasFlights()).toBe(false);
  });

  it('không có icon giỏ, hoặc icon bị phủ (panel đang mở): không bay', () => {
    document.elementFromPoint = vi.fn(() => document.body);
    expect(flyToCart(button, 'gpu')).toBe(false);

    cart.remove();
    expect(flyToCart(button, 'gpu')).toBe(false);
    expect(hasFlights()).toBe(false);
  });

  it('ô tới nơi: bỏ khỏi danh sách và báo cho người nghe, báo một lần', () => {
    const landed = vi.fn();
    const stop = onFlightLanded(landed);
    flyToCart(button, 'gpu');
    const [flight] = getFlights();

    landFlight(flight!.id);
    landFlight(flight!.id);

    expect(hasFlights()).toBe(false);
    expect(landed).toHaveBeenCalledTimes(1);
    stop();
  });
});
