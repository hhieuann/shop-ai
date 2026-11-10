// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Package } from 'lucide-react';
import { EmptyState } from './EmptyState';

afterEach(cleanup);

describe('EmptyState', () => {
  it('emptyState_showsDecorativeIcon_messageAndAction', () => {
    // Act
    const { container } = render(
      <EmptyState
        icon={Package}
        message="Bạn chưa có đơn hàng nào."
        action={<a href="/products">Mua sắm ngay</a>}
      />,
    );

    // Assert
    expect(screen.getByText('Bạn chưa có đơn hàng nào.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mua sắm ngay' })).toHaveAttribute('href', '/products');
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('emptyState_rendersWithoutIconOrAction', () => {
    const { container } = render(<EmptyState message="Không tìm thấy đơn hàng này." />);

    expect(screen.getByText('Không tìm thấy đơn hàng này.')).toBeInTheDocument();
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });
});
