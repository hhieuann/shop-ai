// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Logo } from './Logo';

afterEach(cleanup);

describe('Logo (design-system §9.1, #579)', () => {
  it('isLinkHome_namedByAriaLabel_withTwoDecorativeImages', () => {
    // Act
    render(
      <MemoryRouter>
        <Logo className="x" />
      </MemoryRouter>,
    );

    // Assert: tên đọc cho trình đọc màn hình nằm ở link; hai ảnh chỉ để nhìn
    const link = screen.getByRole('link', { name: 'Black Magic, về trang chủ' });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveClass('x');
    const images = link.querySelectorAll('img');
    expect(images).toHaveLength(2);
    for (const img of images) {
      expect(img).toHaveAttribute('alt', '');
      // Có width, height để không giật bố cục khi ảnh tải
      expect(img).toHaveAttribute('width');
      expect(img).toHaveAttribute('height');
    }
    // Verify: không còn ô gradient, icon hay chữ "Black Magic" dạng văn bản
    expect(link.querySelector('svg')).toBeNull();
    expect(link).not.toHaveTextContent('Black Magic');
  });
});
