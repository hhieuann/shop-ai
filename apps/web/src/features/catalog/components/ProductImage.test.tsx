// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PRODUCT_IMAGE_CREDITS } from '../lib/productImages';
import { ProductImage } from './ProductImage';

afterEach(cleanup);

const DEMO_ID = PRODUCT_IMAGE_CREDITS[0]!.productId;
const fallback = <span data-testid="fallback">icon</span>;

describe('ProductImage (design-system §9.34, #530)', () => {
  it('usesApiImageUrlFirst_evenWhenDemoImageExists', () => {
    // Act
    render(
      <ProductImage
        productId={DEMO_ID}
        imageUrl="https://shop.example/a.webp"
        alt=""
        fallback={fallback}
      />,
    );

    // Assert: ảnh admin đặt luôn ưu tiên
    expect(screen.getByRole('presentation')).toHaveAttribute('src', 'https://shop.example/a.webp');
  });

  it('usesDemoImage_whenApiHasNoImageUrl', () => {
    // Act
    render(<ProductImage productId={DEMO_ID} alt="Tên" fallback={fallback} />);

    // Assert
    expect(screen.getByRole('img', { name: 'Tên' })).toHaveAttribute(
      'src',
      `/product-images/${DEMO_ID}.webp`,
    );
  });

  it('showsFallback_forProductWithoutAnyImage', () => {
    // Act: món admin thêm sau, không có trong bộ ảnh demo
    render(<ProductImage productId="01KAB3Q5G00000000000000001" alt="" fallback={fallback} />);

    // Assert: không gọi ảnh không tồn tại
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('fallsBackStepByStep_whenImagesFailToLoad', () => {
    // Arrange
    render(
      <ProductImage
        productId={DEMO_ID}
        imageUrl="https://shop.example/hong.webp"
        alt=""
        fallback={fallback}
      />,
    );

    // Act: ảnh API lỗi → sang ảnh demo
    fireEvent.error(document.querySelector('img')!);

    // Assert
    expect(document.querySelector('img')).toHaveAttribute('src', `/product-images/${DEMO_ID}.webp`);

    // Act: ảnh demo cũng lỗi → icon
    fireEvent.error(document.querySelector('img')!);

    // Assert
    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('marksSourceApi_whenShowingImageUrl', () => {
    // Act
    render(
      <ProductImage
        productId={DEMO_ID}
        imageUrl="https://shop.example/a.webp"
        alt=""
        fallback={fallback}
      />,
    );

    // Assert: ảnh API giữ contain và lề của ô (CSS theo data-source)
    expect(document.querySelector('img')).toHaveAttribute('data-source', 'api');
  });

  it('marksSourceDemo_whenShowingDemoImage', () => {
    // Act
    render(<ProductImage productId={DEMO_ID} alt="" fallback={fallback} />);

    // Assert: ảnh demo phủ kín ô
    expect(document.querySelector('img')).toHaveAttribute('data-source', 'demo');
  });

  it('switchesSourceToDemo_afterImageUrlFails', () => {
    // Arrange
    render(
      <ProductImage
        productId={DEMO_ID}
        imageUrl="https://shop.example/hong.webp"
        alt=""
        fallback={fallback}
      />,
    );

    // Act
    fireEvent.error(document.querySelector('img')!);

    // Assert
    const img = document.querySelector('img')!;
    expect(img).toHaveAttribute('src', `/product-images/${DEMO_ID}.webp`);
    expect(img).toHaveAttribute('data-source', 'demo');
  });

  it('passesImgAttributesThrough', () => {
    // Act
    render(
      <ProductImage
        productId={DEMO_ID}
        alt=""
        width={240}
        height={240}
        loading="lazy"
        className="x"
        fallback={fallback}
      />,
    );

    // Assert
    const img = document.querySelector('img')!;
    expect(img).toHaveAttribute('width', '240');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveClass('x');
  });
});
