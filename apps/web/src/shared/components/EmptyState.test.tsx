// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Package } from 'lucide-react';
import { EmptyState } from './EmptyState';
import styles from './EmptyState.module.css';

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

describe('EmptyState · tiêu đề và className (#424)', () => {
  it('emptyState_rendersH2TitleInLabelledSection_byDefault', () => {
    // Act
    const { container } = render(<EmptyState title="Chưa có gì" message="Câu giải thích." />);

    // Assert: tiêu đề mặc định h2, khối là section có tên lấy từ tiêu đề
    const heading = screen.getByRole('heading', { level: 2, name: 'Chưa có gì' });
    const section = container.firstElementChild!;
    expect(section.tagName).toBe('SECTION');
    expect(section).toHaveAttribute('aria-labelledby', heading.id);
    expect(screen.getByRole('region', { name: 'Chưa có gì' })).toBe(section);
  });

  it('emptyState_rendersH1Title_whenTitleLevel1', () => {
    render(<EmptyState title="Không tìm thấy trang" titleLevel={1} message="Câu giải thích." />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Không tìm thấy trang' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('emptyState_keepsDivWithoutHeading_whenNoTitle', () => {
    // Act: cách dùng cũ (/orders rỗng, đơn 404) không đổi
    const { container } = render(<EmptyState message="Bạn chưa có đơn hàng nào." />);

    // Assert
    expect(container.firstElementChild!.tagName).toBe('DIV');
    expect(container.firstElementChild).not.toHaveAttribute('aria-labelledby');
    expect(screen.queryByRole('heading')).toBeNull();
  });

  it('emptyState_appendsClassName_toOuterBlock', () => {
    const { container } = render(<EmptyState message="Câu." className="extra" />);

    expect(container.firstElementChild).toHaveClass(styles.empty!, 'extra');
  });
});
