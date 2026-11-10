// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Badge, type BadgeTone } from './Badge';
import styles from './Badge.module.css';

afterEach(cleanup);

const TONES: BadgeTone[] = ['success', 'warning', 'danger', 'primary', 'accent', 'neutral'];

describe('Badge', () => {
  it.each(TONES)('badge_hasToneClass_%s', (tone) => {
    // Act
    render(<Badge tone={tone}>Nhãn</Badge>);

    // Assert
    const badge = screen.getByText('Nhãn');
    expect(badge).toHaveClass(styles.badge!, styles[tone]!);
    // Verify: chỉ một tone
    const others = TONES.filter((t) => t !== tone).map((t) => styles[t]!);
    for (const cls of others) expect(badge).not.toHaveClass(cls);
  });
});
