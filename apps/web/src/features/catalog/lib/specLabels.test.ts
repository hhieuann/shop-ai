import { describe, expect, it } from 'vitest';
import seed from '../../../../../../services/api/seed/catalog/products.json';
import type { ProductCategory } from '../../../shared/api/types';
import { SPEC_ORDER, specEntries, specRows } from './specLabels';

describe('specRows', () => {
  it('đổi khoá sang nhãn có dấu, giữ thứ tự khoá', () => {
    expect(specRows({ vram: '8GB GDDR6', nguon_de_xuat: '550W' })).toEqual([
      { label: 'VRAM', value: '8GB GDDR6' },
      { label: 'Nguồn đề xuất', value: '550W' },
    ]);
  });

  it('khoá chưa có nhãn thì hiện nguyên mã', () => {
    expect(specRows({ khoa_moi: 'abc' })).toEqual([{ label: 'khoa_moi', value: 'abc' }]);
  });

  it('true/false thành Có/Không, mảng nối bằng dấu phẩy, bỏ object lồng và chuỗi rỗng', () => {
    expect(
      specRows({ wifi: true, rgb: false, cong: ['HDMI', 'DP'], quat: { so: 3 }, mau: ' ' }),
    ).toEqual([
      { label: 'Wi-Fi', value: 'Có' },
      { label: 'RGB', value: 'Không' },
      { label: 'Cổng', value: 'HDMI, DP' },
    ]);
  });

  it('không có specs thì không có dòng nào', () => {
    expect(specRows(undefined)).toEqual([]);
  });
});

describe('specEntries', () => {
  it('xếp theo SPEC_ORDER của loại hàng, không theo thứ tự khoá trả về', () => {
    // Map DynamoDB trả khoá theo thứ tự bất kỳ
    const specs = { man_hinh: '15.6" FHD 144Hz', ram: '16GB DDR5', cpu: 'Ryzen 7 7735HS' };
    expect(specEntries('laptop', specs).map((e) => e.key)).toEqual(['cpu', 'ram', 'man_hinh']);
  });

  it('trả kèm khoá, nhãn có dấu và giá trị', () => {
    expect(specEntries('gpu', { nguon_de_xuat: '550W', vram: '8GB GDDR6' })).toEqual([
      { key: 'vram', label: 'VRAM', value: '8GB GDDR6' },
      { key: 'nguon_de_xuat', label: 'Nguồn đề xuất', value: '550W' },
    ]);
  });

  it('khoá không có trong bảng xếp sau, giữ thứ tự trả về, nhãn là nguyên mã', () => {
    const specs = { khoa_b: 'b', vram: '8GB', khoa_a: 'a', kich_thuoc: '240mm' };
    expect(specEntries('gpu', specs).map((e) => [e.key, e.label])).toEqual([
      ['vram', 'VRAM'],
      ['kich_thuoc', 'Kích thước'],
      ['khoa_b', 'khoa_b'],
      ['khoa_a', 'khoa_a'],
    ]);
  });

  it('true/false thành Có/Không, mảng nối bằng dấu phẩy, bỏ object lồng và chuỗi rỗng', () => {
    const specs = {
      wifi: true,
      socket: ['AM5'],
      chipset: { ten: 'B650' },
      ram: ' ',
      kich_thuoc: false,
    };
    expect(specEntries('mainboard', specs)).toEqual([
      { key: 'socket', label: 'Socket', value: 'AM5' },
      { key: 'kich_thuoc', label: 'Kích thước', value: 'Không' },
      { key: 'wifi', label: 'Wi-Fi', value: 'Có' },
    ]);
  });

  it('không có specs hoặc không còn dòng nào thì trả mảng rỗng', () => {
    expect(specEntries('mouse', undefined)).toEqual([]);
    expect(specEntries('mouse', { dpi: '', pin: { gio: 70 } })).toEqual([]);
  });

  it('mọi khoá trong bộ dữ liệu demo đều có trong SPEC_ORDER của loại hàng và có nhãn', () => {
    for (const { category, specs } of seed.products) {
      const order = SPEC_ORDER[category as ProductCategory];
      for (const entry of specEntries(category as ProductCategory, specs)) {
        expect(order, `${category}.${entry.key}`).toContain(entry.key);
        expect(entry.label, `${category}.${entry.key}`).not.toBe(entry.key);
      }
    }
  });
});
