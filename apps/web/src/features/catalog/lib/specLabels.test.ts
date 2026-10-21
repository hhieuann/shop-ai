import { describe, expect, it } from 'vitest';
import { specRows } from './specLabels';

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
