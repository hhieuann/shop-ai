import { describe, expect, it } from 'vitest';
import { specSummary } from './specSummary';

describe('specSummary', () => {
  // Ví dụ lấy đúng như bảng design-system §9.19
  it.each([
    {
      category: 'laptop',
      specs: {
        cpu: 'Ryzen 7 7735HS',
        gpu: 'RTX 4060',
        ram: '16GB DDR5',
        ssd: '512GB',
        man_hinh: '15.6" FHD 144Hz',
      },
      text: 'Ryzen 7 7735HS · 16GB DDR5 · 512GB · 15.6" FHD 144Hz',
    },
    {
      category: 'cpu',
      specs: { socket: 'LGA1700', nhan_luong: '10/16', xung_toi_da: '4.7GHz', tdp: '65W' },
      text: 'LGA1700 · 10/16 · 4.7GHz',
    },
    {
      category: 'gpu',
      specs: { vram: '12GB GDDR6X', nguon_de_xuat: '750W', cong_cap: '1x 16-pin' },
      text: '12GB GDDR6X · 750W',
    },
    {
      category: 'ram',
      specs: { loai: 'DDR4', dung_luong: '16GB (2x8GB)', bus: '3200MHz' },
      text: 'DDR4 · 16GB (2x8GB) · 3200MHz',
    },
    {
      category: 'storage',
      specs: { dung_luong: '1TB', chuan: 'M.2 NVMe PCIe 4.0', doc: '7450MB/s', ghi: '6900MB/s' },
      text: '1TB · M.2 NVMe PCIe 4.0 · 7450MB/s',
    },
    {
      category: 'mainboard',
      specs: { socket: 'LGA1700', chipset: 'B760', kich_thuoc: 'mATX' },
      text: 'LGA1700 · B760 · mATX',
    },
    {
      category: 'psu',
      specs: { cong_suat: '750W', chuan: '80 Plus Gold' },
      text: '750W · 80 Plus Gold',
    },
    {
      category: 'cooling',
      specs: { loai: 'Tản nước AIO', radiator: '240mm' },
      text: 'Tản nước AIO · 240mm',
    },
    {
      category: 'keyboard',
      specs: { layout: 'TKL', switch: 'Gateron Brown', ket_noi: 'Bluetooth, USB-C' },
      text: 'TKL · Gateron Brown · Bluetooth, USB-C',
    },
    {
      category: 'mouse',
      specs: { ket_noi: 'Lightspeed', dpi: '25600' },
      text: 'Lightspeed · 25600',
    },
    {
      category: 'monitor',
      specs: { kich_thuoc: '27"', do_phan_giai: '2560x1440', tan_so: '165Hz', tam_nen: 'IPS' },
      text: '27" · 2560x1440 · 165Hz · IPS',
    },
    { category: 'headset', specs: { ket_noi: '3.5mm, USB', mic: 'Rời' }, text: '3.5mm, USB · Rời' },
    { category: 'accessory', specs: { loai: 'Balo', kich_thuoc: '15.6"' }, text: 'Balo · 15.6"' },
  ] as const)('$category', ({ category, specs, text }) => {
    expect(specSummary(category, specs)).toBe(text);
  });

  it('a|b: không có khoá đầu thì lấy khoá sau', () => {
    expect(specSummary('laptop', { chip: 'Apple M3', ram: '8GB' })).toBe('Apple M3 · 8GB');
    expect(
      specSummary('storage', { dung_luong: '1TB', ket_noi: 'SATA III', toc_do: '560MB/s' }),
    ).toBe('1TB · SATA III · 560MB/s');
  });

  it('khoá thiếu, chuỗi rỗng, object bị bỏ qua; số được nhận', () => {
    expect(
      specSummary('monitor', {
        kich_thuoc: '24"',
        do_phan_giai: '',
        tan_so: 144,
        tam_nen: { x: 1 },
      }),
    ).toBe('24" · 144');
  });

  it('không có specs hoặc không khoá nào có giá trị: chuỗi rỗng', () => {
    expect(specSummary('gpu', undefined)).toBe('');
    expect(specSummary('gpu', {})).toBe('');
    expect(specSummary('gpu', { cong_cap: '1x 8-pin' })).toBe('');
  });
});
