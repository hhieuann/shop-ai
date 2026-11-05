// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../../../shared/api/client';
import { OrderErrorMessage } from './CheckoutPage';

afterEach(cleanup);

describe('OrderErrorMessage', () => {
  it('tooManyOpenOrders_showsSpecSentence_andLinkToOrders', () => {
    // Arrange: API trả 409 kèm detail ngắn hơn câu trong spec (#315)
    const error = new ApiError(
      409,
      { code: 'TOO_MANY_OPEN_ORDERS', title: 'Conflict', detail: 'Bạn đang có 3 đơn chưa giao' },
      'Conflict',
    );

    // Act
    render(
      <MemoryRouter>
        <OrderErrorMessage error={error} nameOf={(id) => id} />
      </MemoryRouter>,
    );

    // Assert: đúng câu ở ordering.md mục Màn hình
    expect(
      screen.getByText(
        /Bạn đang có 3 đơn chưa giao\. Huỷ bớt đơn hoặc chờ đơn được giao rồi đặt tiếp\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Xem đơn hàng' })).toHaveAttribute('href', '/orders');
  });
});
