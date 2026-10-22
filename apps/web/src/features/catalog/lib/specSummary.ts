import type { ProductCategory } from './productFilters';

/**
 * Khoá thông số hiện trên thẻ trang danh sách, theo loại hàng (design-system §9.19).
 * "a|b": lấy khoá đầu tiên có giá trị. Khoá là mã tiếng Việt không dấu trong specs (catalog.md).
 */
const SUMMARY_KEYS: Record<ProductCategory, readonly string[]> = {
  laptop: ['cpu|chip', 'ram', 'ssd', 'man_hinh'],
  cpu: ['socket', 'nhan_luong', 'xung_toi_da'],
  gpu: ['vram', 'nguon_de_xuat'],
  ram: ['loai', 'dung_luong', 'bus'],
  storage: ['dung_luong', 'chuan|ket_noi', 'doc|toc_do'],
  mainboard: ['socket', 'chipset', 'kich_thuoc'],
  psu: ['cong_suat', 'chuan'],
  cooling: ['loai', 'radiator'],
  keyboard: ['layout', 'switch', 'ket_noi'],
  mouse: ['ket_noi', 'dpi'],
  monitor: ['kich_thuoc', 'do_phan_giai', 'tan_so', 'tam_nen'],
  headset: ['ket_noi', 'mic'],
  accessory: ['loai', 'kich_thuoc|chuan'],
};

const MAX_VALUES = 4;

/** Chỉ nhận chuỗi (bỏ khoảng trắng hai đầu) và số; giá trị khác (object, rỗng) coi như không có */
function asText(value: unknown): string | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return undefined;
}

/**
 * Dòng tóm tắt thông số của thẻ: giá trị (không kèm nhãn) theo thứ tự trong bảng, tối đa 4,
 * nối bằng " · ". Không có specs hoặc không khoá nào có giá trị thì trả chuỗi rỗng.
 */
export function specSummary(
  category: ProductCategory,
  specs: Readonly<Record<string, unknown>> | undefined,
): string {
  if (!specs) return '';
  const values: string[] = [];
  for (const entry of SUMMARY_KEYS[category]) {
    const value = entry
      .split('|')
      .map((key) => asText(specs[key]))
      .find((v) => v !== undefined);
    if (value !== undefined) values.push(value);
    if (values.length === MAX_VALUES) break;
  }
  return values.join(' · ');
}
