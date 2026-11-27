import { describe, expect, it, vi } from 'vitest';
import { uniqueProduct } from '../../../../test/helpers/catalog.js';
import type { AdminProductGroup } from '../domain/adminProduct.js';
import { InvalidCursorError } from '../domain/errors.js';
import type { Product, ProductCategory } from '../domain/product.js';
import { listAdminProducts } from './listAdminProducts.js';

const DELETED_AT = '2026-11-25T08:00:00.000Z';

/** Bảng giả: món theo nhóm, đếm bằng số món của nhóm đó */
function fakeReader(groups: Partial<Record<AdminProductGroup, Product[]>>) {
  return {
    listByGroup: vi.fn(async (_category: ProductCategory, group: AdminProductGroup) => [
      ...(groups[group] ?? []),
    ]),
    countByGroup: vi.fn(
      async (_category: ProductCategory, group: AdminProductGroup) => groups[group]?.length ?? 0,
    ),
  };
}

describe('listAdminProducts', () => {
  const active1 = uniqueProduct({ category: 'gpu', name: 'Card RTX 4060' });
  const hidden = uniqueProduct({ category: 'gpu', name: 'Card GTX 1650', status: 'INACTIVE' });
  const active2 = uniqueProduct({ category: 'gpu', name: 'Card RTX 4070' });
  const deleted = uniqueProduct({
    category: 'gpu',
    name: 'Card RTX 3060',
    status: 'INACTIVE',
    deletedAt: DELETED_AT,
  });
  const groups = { ACTIVE: [active1, active2], INACTIVE: [hidden], DELETED: [deleted] };

  it('listAdminProducts_returnsActiveAndHiddenNewestFirst_withCounts_whenStatusMissing', async () => {
    // Arrange
    const reader = fakeReader(groups);

    // Act
    const result = await listAdminProducts({ reader }, { category: 'gpu' });

    // Assert
    expect(result.items.map((p) => p.productId)).toEqual([
      active2.productId,
      hidden.productId,
      active1.productId,
    ]);
    expect(result.counts).toEqual({ active: 2, inactive: 1, deleted: 1 });
    expect(result.nextCursor).toBeUndefined();
    // Verify: đọc 2 nhóm, đếm 3 nhóm, mỗi nhóm một lần, đúng loại
    expect(reader.listByGroup.mock.calls).toEqual([
      ['gpu', 'ACTIVE'],
      ['gpu', 'INACTIVE'],
    ]);
    expect(reader.countByGroup).toHaveBeenCalledTimes(3);
    expect(reader.countByGroup.mock.calls.map(([, g]) => g).sort()).toEqual([
      'ACTIVE',
      'DELETED',
      'INACTIVE',
    ]);
  });

  it('listAdminProducts_readsOnlyDeletedGroup_whenStatusDeleted', async () => {
    // Arrange
    const reader = fakeReader(groups);

    // Act
    const result = await listAdminProducts({ reader }, { category: 'gpu', status: 'DELETED' });

    // Assert
    expect(result.items).toEqual([deleted]);
    // Verify
    expect(reader.listByGroup).toHaveBeenCalledTimes(1);
    expect(reader.listByGroup).toHaveBeenCalledWith('gpu', 'DELETED');
  });

  it('listAdminProducts_filtersByName_butCountsStayForWholeCategory', async () => {
    // Arrange
    const reader = fakeReader(groups);

    // Act
    const result = await listAdminProducts({ reader }, { category: 'gpu', q: 'rtx' });

    // Assert
    expect(result.items.map((p) => p.name)).toEqual(['Card RTX 4070', 'Card RTX 4060']);
    expect(result.counts).toEqual({ active: 2, inactive: 1, deleted: 1 });
  });

  it('listAdminProducts_paginatesWithLimitAndCursor', async () => {
    // Arrange
    const reader = fakeReader(groups);

    // Act
    const first = await listAdminProducts({ reader }, { category: 'gpu', limit: 2 });
    const second = await listAdminProducts(
      { reader },
      { category: 'gpu', limit: 2, cursor: first.nextCursor },
    );

    // Assert
    expect(first.items).toHaveLength(2);
    expect(first.nextCursor).toBeDefined();
    expect(second.items.map((p) => p.productId)).toEqual([active1.productId]);
    expect(second.nextCursor).toBeUndefined();
  });

  it('listAdminProducts_usesDefaultPageSize20_whenLimitMissing', async () => {
    // Arrange
    const many = Array.from({ length: 25 }, () => uniqueProduct({ category: 'gpu' }));
    const reader = fakeReader({ ACTIVE: many });

    // Act
    const result = await listAdminProducts({ reader }, { category: 'gpu' });

    // Assert
    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBeDefined();
  });

  it('listAdminProducts_throwsInvalidCursor_whenCursorMalformed', async () => {
    // Arrange
    const reader = fakeReader(groups);

    // Act
    const act = listAdminProducts({ reader }, { category: 'gpu', cursor: 'khong-hop-le' });

    // Assert
    await expect(act).rejects.toBeInstanceOf(InvalidCursorError);
  });
});
