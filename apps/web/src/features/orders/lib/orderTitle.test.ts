import { describe, expect, it } from 'vitest';
import { orderTitle, orderTitleParts } from './orderTitle';

const LAPTOP = 'Laptop ASUS TUF Gaming A15 FA507NV';

describe('orderTitle', () => {
  it('orderTitle_isItemName_whenOneItem', () => {
    expect(orderTitle(LAPTOP, 1)).toBe(LAPTOP);
  });

  it('orderTitle_addsOneOther_whenTwoItems', () => {
    expect(orderTitle(LAPTOP, 2)).toBe(`${LAPTOP} và 1 sản phẩm khác`);
  });

  it('orderTitle_addsFourOthers_whenFiveItems', () => {
    expect(orderTitle(LAPTOP, 5)).toBe(`${LAPTOP} và 4 sản phẩm khác`);
  });
});

describe('orderTitleParts', () => {
  it('orderTitleParts_hasNoOthers_whenOneItem', () => {
    expect(orderTitleParts(LAPTOP, 1)).toEqual({ name: LAPTOP });
  });

  it('orderTitleParts_splitsNameAndOthers_whenManyItems', () => {
    expect(orderTitleParts(LAPTOP, 3)).toEqual({ name: LAPTOP, others: 'và 2 sản phẩm khác' });
  });
});
