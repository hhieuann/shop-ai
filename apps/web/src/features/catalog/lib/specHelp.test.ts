import { describe, expect, it } from 'vitest';
import seed from '../../../../../../services/api/seed/catalog/products.json';
import { specHelp } from './specHelp';

describe('specHelp', () => {
  it('ưu tiên nghĩa riêng của loại hàng (loại.khoá)', () => {
    expect(specHelp('gpu', 'kich_thuoc')).toBe('Chiều dài của card, đo bằng mm.');
    expect(specHelp('monitor', 'kich_thuoc')).toBe('Kích thước đường chéo màn hình, đo bằng inch.');
  });

  it('không có nghĩa riêng thì rơi về nghĩa chung (khoá)', () => {
    expect(specHelp('psu', 'kich_thuoc')).toBe('Kích thước theo thông số của hãng.');
    expect(specHelp('laptop', 'cpu')).toBe(
      'Bộ xử lý trung tâm, chạy hệ điều hành và mọi ứng dụng. Tên mẫu cho biết dòng chip, đời chip và phân khúc.',
    );
  });

  it('khoá chưa có câu giải thích thì trả undefined', () => {
    expect(specHelp('laptop', 'khoa_moi')).toBeUndefined();
  });

  it('mọi cặp loại.khoá trong bộ dữ liệu demo đều có câu giải thích', () => {
    const pairs = new Set(
      seed.products.flatMap((p) => Object.keys(p.specs ?? {}).map((k) => `${p.category}.${k}`)),
    );
    expect(pairs.size).toBe(70);
    for (const pair of pairs) {
      const [category, key] = pair.split('.') as [string, string];
      expect(specHelp(category, key), pair).toBeTruthy();
    }
  });
});
