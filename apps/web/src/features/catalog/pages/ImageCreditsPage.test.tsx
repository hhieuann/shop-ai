// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PRODUCT_IMAGE_CREDITS } from '../lib/productImages';
import { ImageCreditsPage } from './ImageCreditsPage';

afterEach(cleanup);

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/image-credits']}>
      <ImageCreditsPage />
    </MemoryRouter>,
  );
}

describe('ImageCreditsPage (pages/nguon-anh.md, #530)', () => {
  it('statesImagesBelongToManufacturers_forStudyProject_andRemovalOnRequest', () => {
    // Act
    renderPage();

    // Assert
    expect(
      screen.getByRole('heading', { level: 1, name: 'Nguồn ảnh sản phẩm' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/thuộc về nhà sản xuất/)).toHaveTextContent(/dự án học tập/);
    expect(screen.getByText(/sẽ gỡ ảnh nếu/)).toBeInTheDocument();
    expect(document.title).toBe('Nguồn ảnh sản phẩm | Black Magic');
  });

  it('listsEveryProduct_withBrand_andManufacturerLinkWhenKnown', () => {
    // Act
    renderPage();

    // Assert
    const list = screen.getAllByRole('list').find((l) => l.querySelectorAll('li').length > 50)!;
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(PRODUCT_IMAGE_CREDITS.length);
    const withPage = PRODUCT_IMAGE_CREDITS.find((c) => c.page)!;
    const row = rows.find((r) => r.textContent?.includes(withPage.name))!;
    expect(row).toHaveTextContent(`Ảnh thuộc về ${withPage.brand}`);
    const link = within(row).getByRole('link', { name: /Trang sản phẩm của hãng/ });
    expect(link).toHaveAttribute('href', withPage.page);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Verify: món không có trang hãng thì không có link
    const noPage = PRODUCT_IMAGE_CREDITS.find((c) => !c.page)!;
    const plain = rows.find((r) => r.textContent?.includes(noPage.name))!;
    expect(within(plain).queryByRole('link')).toBeNull();
  });
});
