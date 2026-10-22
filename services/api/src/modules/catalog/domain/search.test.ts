import { describe, expect, it } from 'vitest';
import { uniqueProduct } from '../../../../test/helpers/catalog.js';
import { matchesSearch, toSearchText, withSearchText } from './search.js';

describe('toSearchText', () => {
  it.each([
    ['RTX', 'rtx'],
    ['Chuột Logitech G502', 'chuot logitech g502'],
    ['Đế tản nhiệt laptop', 'de tan nhiet laptop'],
    ['Bàn phím cơ ĐEN', 'ban phim co den'],
    ['  ASUS   TUF\tGaming  ', 'asus tuf gaming'],
    ['', ''],
  ])('toSearchText_normalizes_%j', (input, expected) => {
    // Act
    const result = toSearchText(input);

    // Assert
    expect(result).toBe(expected);
  });
});

describe('matchesSearch', () => {
  const rtx = withSearchText(uniqueProduct({ name: 'ASUS TUF Gaming GeForce RTX 4070' }));

  it('matchesSearch_returnsTrue_whenKeywordInMiddleOfName', () => {
    // Act + Assert
    expect(matchesSearch(rtx, toSearchText('rtx'))).toBe(true);
    expect(matchesSearch(rtx, toSearchText('RTX 40'))).toBe(true);
  });

  it('matchesSearch_returnsFalse_whenKeywordAbsent', () => {
    // Act + Assert
    expect(matchesSearch(rtx, toSearchText('radeon'))).toBe(false);
  });

  it('matchesSearch_ignoresDiacritics_whenKeywordTypedWithoutAccents', () => {
    // Arrange
    const mouse = withSearchText(uniqueProduct({ name: 'Chuột Logitech G502' }));

    // Act + Assert
    expect(matchesSearch(mouse, toSearchText('chuot'))).toBe(true);
    expect(matchesSearch(mouse, toSearchText('CHUỘT'))).toBe(true);
  });
});

describe('withSearchText', () => {
  it('withSearchText_keepsProductFields_andAddsNormalizedName', () => {
    // Arrange
    const product = uniqueProduct({ name: 'Tai nghe HyperX Cloud' });

    // Act
    const result = withSearchText(product);

    // Assert
    expect(result).toEqual({ ...product, searchText: 'tai nghe hyperx cloud' });
  });
});
