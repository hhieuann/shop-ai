import { describe, expect, it } from 'vitest';
import { ADMIN_GROUP, isInGroup, parseGroups } from './claims.js';

describe('parseGroups', () => {
  it.each<[string, unknown, string[]]>([
    ['chuỗi một nhóm như HTTP API gửi', '[admin]', ['admin']],
    ['chuỗi nhiều nhóm cách nhau bằng khoảng trắng', '[admin customer]', ['admin', 'customer']],
    ['chuỗi nhiều nhóm cách nhau bằng dấu phẩy', '[admin, customer]', ['admin', 'customer']],
    ['mảng', ['admin', 'customer'], ['admin', 'customer']],
    ['chuỗi rỗng', '[]', []],
    ['không có claim', undefined, []],
    ['kiểu lạ', 42, []],
  ])('parseGroups_%s', (_name, raw, expected) => {
    expect(parseGroups(raw)).toEqual(expected);
  });
});

describe('isInGroup', () => {
  it('isInGroup_true_whenClaimIsStringOrArrayWithAdmin', () => {
    expect(isInGroup({ 'cognito:groups': '[admin]' }, ADMIN_GROUP)).toBe(true);
    expect(isInGroup({ 'cognito:groups': ['admin'] }, ADMIN_GROUP)).toBe(true);
  });

  it('isInGroup_false_whenOnlySimilarNameOrNoClaim', () => {
    // "administrator" không phải nhóm admin: so cả tên, không so chuỗi con
    expect(isInGroup({ 'cognito:groups': '[administrator]' }, ADMIN_GROUP)).toBe(false);
    expect(isInGroup({ sub: 'u-1' }, ADMIN_GROUP)).toBe(false);
    expect(isInGroup(undefined, ADMIN_GROUP)).toBe(false);
  });
});
