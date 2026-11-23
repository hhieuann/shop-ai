// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import badgeStyles from '../../../shared/components/Badge.module.css';
import { OrderStatusBadge } from './OrderStatusBadge';

afterEach(cleanup);

describe('OrderStatusBadge', () => {
  it.each([
    ['PENDING', 'Chờ xác nhận', 'neutral'],
    ['CONFIRMED', 'Đã xác nhận', 'primary'],
    ['SHIPPED', 'Đang giao', 'accent'],
    ['DELIVERED', 'Đã giao', 'success'],
    ['CANCELLED', 'Đã huỷ', 'danger'],
  ] as const)('orderStatusBadge_showsLabelAndTone_%s', (status, label, tone) => {
    // Act
    render(<OrderStatusBadge status={status} />);

    // Assert
    expect(screen.getByText(label)).toHaveClass(badgeStyles.badge!, badgeStyles[tone]!);
  });
});
