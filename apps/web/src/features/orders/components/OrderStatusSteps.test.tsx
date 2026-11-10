// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { OrderStatusSteps } from './OrderStatusSteps';

afterEach(cleanup);

// 03:24 UTC = 10:24 giờ Việt Nam
const CREATED = '2026-11-09T03:24:00Z';

function steps() {
  return screen.getAllByRole('listitem');
}

describe('OrderStatusSteps', () => {
  it('orderStatusSteps_marksCurrentStep_only', () => {
    // Act
    render(
      <OrderStatusSteps status="SHIPPED" createdAt={CREATED} updatedAt="2026-11-10T02:10:00Z" />,
    );

    // Assert: 4 bước theo thứ tự, chỉ "Đang giao" là bước hiện tại
    const items = steps();
    expect(items.map((li) => within(li).getByText(/Chờ|Đã|Đang/).textContent)).toEqual([
      'Chờ xác nhận',
      'Đã xác nhận',
      'Đang giao',
      'Đã giao',
    ]);
    expect(items[2]).toHaveAttribute('aria-current', 'step');
    for (const i of [0, 1, 3]) expect(items[i]).not.toHaveAttribute('aria-current');
  });

  it('orderStatusSteps_showsTime_onFirstAndCurrentStep', () => {
    // Act
    render(
      <OrderStatusSteps status="SHIPPED" createdAt={CREATED} updatedAt="2026-11-10T02:10:00Z" />,
    );

    // Assert: bước đầu giờ đặt, bước hiện tại giờ cập nhật, bước khác không có giờ
    const items = steps();
    expect(items[0]).toHaveTextContent('09/11/2026 10:24');
    expect(items[2]).toHaveTextContent('10/11/2026 09:10');
    expect(items[1]!.querySelector('time')).toBeNull();
    expect(items[3]!.querySelector('time')).toBeNull();
  });

  it('orderStatusSteps_showsOneTime_whenPending', () => {
    render(<OrderStatusSteps status="PENDING" createdAt={CREATED} updatedAt={CREATED} />);

    const items = steps();
    expect(items[0]).toHaveAttribute('aria-current', 'step');
    expect(screen.getAllByText('09/11/2026 10:24')).toHaveLength(1);
    expect(document.querySelectorAll('time')).toHaveLength(1);
  });

  it('orderStatusSteps_dropsCurrentTime_whenSameMinuteAsCreated', () => {
    // Arrange: worker xác nhận sau 3 giây, cùng phút với lúc đặt
    render(
      <OrderStatusSteps status="CONFIRMED" createdAt={CREATED} updatedAt="2026-11-09T03:24:03Z" />,
    );

    // Assert
    const items = steps();
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[1]!.querySelector('time')).toBeNull();
    expect(document.querySelectorAll('time')).toHaveLength(1);
  });

  it('orderStatusSteps_hidesDots_fromScreenReaders', () => {
    const { container } = render(
      <OrderStatusSteps status="DELIVERED" createdAt={CREATED} updatedAt="2026-11-12T01:00:00Z" />,
    );

    const dots = container.querySelectorAll('li > span[aria-hidden="true"]');
    expect(dots).toHaveLength(4);
  });
});
