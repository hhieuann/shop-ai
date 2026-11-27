import { describe, expect, it } from 'vitest';
import { imageKey, imagePublicUrl, isShopBaseUrl } from './domain/productImage.js';
import { productImagesConfig } from './productImagesConfig.js';

const PARAM = '/shop-dev/web/base-url';

describe('productImagesConfig', () => {
  it('enabled_withBucketAndSsmParameterName', () => {
    expect(
      productImagesConfig({ PRODUCT_IMAGES_BUCKET: 'b', PRODUCT_IMAGES_BASE_URL_PARAM: PARAM }),
    ).toEqual({ enabled: true, config: { bucket: 'b', baseUrlParameter: PARAM } });
  });

  it.each(['', 'shop-dev/web/base-url', 'https://d111111abcdef8.cloudfront.net', '/a b'])(
    'disabled_whenParamIsNotSsmName_%s',
    (param) => {
      expect(
        productImagesConfig({ PRODUCT_IMAGES_BUCKET: 'b', PRODUCT_IMAGES_BASE_URL_PARAM: param }),
      ).toEqual({ enabled: false, missing: ['PRODUCT_IMAGES_BASE_URL_PARAM'] });
    },
  );

  it('disabled_listsMissingVars', () => {
    expect(productImagesConfig({})).toEqual({
      enabled: false,
      missing: ['PRODUCT_IMAGES_BUCKET', 'PRODUCT_IMAGES_BASE_URL_PARAM'],
    });
    expect(
      productImagesConfig({ PRODUCT_IMAGES_BUCKET: '', PRODUCT_IMAGES_BASE_URL_PARAM: PARAM }),
    ).toEqual({ enabled: false, missing: ['PRODUCT_IMAGES_BUCKET'] });
  });
});

describe('productImage', () => {
  it('imageKey_usesIdAndTypeExtension_jpegAsJpg', () => {
    expect(imageKey('01KAB', 'image/jpeg')).toBe('products/01KAB.jpg');
    expect(imageKey('01KAB', 'image/webp')).toBe('products/01KAB.webp');
  });

  it('imagePublicUrl_isFullHttpsUrl_trailingSlashTrimmed', () => {
    expect(imagePublicUrl('https://d1.cloudfront.net', 'products/a.jpg')).toBe(
      'https://d1.cloudfront.net/images/products/a.jpg',
    );
    expect(imagePublicUrl('https://d1.cloudfront.net/', 'products/a.jpg')).toBe(
      'https://d1.cloudfront.net/images/products/a.jpg',
    );
  });

  it.each(['https://d1.cloudfront.net', 'https://d1.cloudfront.net/', 'https://shop.example'])(
    'isShopBaseUrl_accepts_%s',
    (value) => {
      expect(isShopBaseUrl(value)).toBe(true);
    },
  );

  it.each([
    '',
    'http://d1.cloudfront.net',
    '/images',
    'd1.cloudfront.net',
    'https://',
    'https://d1.cloudfront.net/images',
    'https://d1 .net',
  ])('isShopBaseUrl_rejects_%s', (value) => {
    expect(isShopBaseUrl(value)).toBe(false);
  });
});
