// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Price } from './Price';
import styles from './Price.module.css';

afterEach(cleanup);

describe('Price', () => {
  it('size title: gắn class title, trình đọc màn hình vẫn nghe "… đồng"', () => {
    const { container } = render(<Price amount={1_490_000} size="title" />);
    expect(container.firstElementChild).toHaveClass(styles.title!);
    expect(screen.getByText(/1\.490\.000 đồng/)).toBeInTheDocument();
  });

  it('size mặc định md: không gắn class cỡ khác', () => {
    const { container } = render(<Price amount={350_000} />);
    expect(container.firstElementChild).not.toHaveClass(styles.title!);
    expect(container.firstElementChild).not.toHaveClass(styles.lg!);
  });
});
