import type { ProductCategory } from '../../../shared/api/types';

/**
 * Nhãn có dấu cho khoá `specs` (khoá là mã tiếng Việt không dấu, chi-tiet-san-pham.md mục 8).
 * Khoá chưa có nhãn thì hiện nguyên mã.
 */
const SPEC_LABELS: Readonly<Record<string, string>> = {
  bo_nho_dem: 'Bộ nhớ đệm',
  bus: 'Bus',
  cam_bien: 'Cảm biến',
  chieu_cao: 'Chiều cao',
  chieu_dai: 'Chiều dài',
  chip: 'Chip',
  chipset: 'Chipset',
  chong_on: 'Chống ồn',
  chuan: 'Chuẩn',
  cong: 'Cổng',
  cong_16pin: 'Cổng 16-pin',
  cong_cap: 'Cổng cấp nguồn',
  cong_suat: 'Công suất',
  cpu: 'CPU',
  do_cong: 'Độ cong',
  do_hoa_tich_hop: 'Đồ hoạ tích hợp',
  do_phan_giai: 'Độ phân giải',
  doc: 'Tốc độ đọc',
  dpi: 'DPI',
  driver: 'Driver',
  dung_luong: 'Dung lượng',
  ghi: 'Tốc độ ghi',
  giao_tiep: 'Giao tiếp',
  gpu: 'GPU',
  hot_swap: 'Hot-swap',
  ket_noi: 'Kết nối',
  keycap: 'Keycap',
  khe_m2: 'Khe M.2',
  khoi_luong: 'Khối lượng',
  khung: 'Khung',
  kich_thuoc: 'Kích thước',
  kich_thuoc_toi_da: 'Kích thước tối đa',
  kien_truc: 'Kiến trúc',
  kieu: 'Kiểu',
  layout: 'Layout',
  loai: 'Loại',
  man_hinh: 'Màn hình',
  mau: 'Màu',
  mic: 'Micro',
  modular: 'Modular',
  nguon_de_xuat: 'Nguồn đề xuất',
  nhan_luong: 'Nhân / luồng',
  npu: 'NPU',
  phim_macro: 'Phím macro',
  pin: 'Pin',
  quat: 'Quạt',
  radiator: 'Radiator',
  ram: 'RAM',
  rgb: 'RGB',
  sac: 'Sạc',
  so_luong: 'Số lượng',
  so_nut: 'Số nút',
  socket: 'Socket',
  ssd: 'SSD',
  switch: 'Switch',
  tam_nen: 'Tấm nền',
  tan_kem_theo: 'Tản kèm theo',
  tan_so: 'Tần số quét',
  tdp: 'TDP',
  tdp_toi_da: 'TDP tối đa',
  thoi_gian_phan_hoi: 'Thời gian phản hồi',
  toc_do: 'Tốc độ',
  trong_luong: 'Trọng lượng',
  ung_dung_tuy_bien: 'Tuỳ biến phím',
  usb_c: 'USB-C',
  vram: 'VRAM',
  wifi: 'Wi-Fi',
  wifi_chuan: 'Chuẩn Wi-Fi',
  xung_toi_da: 'Xung tối đa',
};

/** Giá trị theo chi-tiet-san-pham.md mục 3.5: chuỗi/số in nguyên, true/false → Có/Không, mảng nối ", ", object lồng bỏ qua */
function specValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() === '' ? undefined : value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (Array.isArray(value)) {
    const parts = value.map(specValue).filter((v): v is string => v !== undefined);
    return parts.length > 0 ? parts.join(', ') : undefined;
  }
  return undefined;
}

/**
 * Thứ tự hiện thông số theo loại hàng (design-system §9.24). Không dựa vào thứ tự khoá API trả về:
 * bảng lưu `specs` dạng Map của DynamoDB, thứ tự khoá không được đảm bảo.
 */
export const SPEC_ORDER: Readonly<Record<ProductCategory, readonly string[]>> = {
  laptop: ['cpu', 'chip', 'gpu', 'ram', 'ssd', 'man_hinh', 'pin', 'trong_luong'],
  cpu: [
    'socket',
    'nhan_luong',
    'xung_toi_da',
    'bo_nho_dem',
    'tdp',
    'do_hoa_tich_hop',
    'npu',
    'tan_kem_theo',
  ],
  gpu: ['kien_truc', 'vram', 'giao_tiep', 'nguon_de_xuat', 'cong_cap', 'kich_thuoc'],
  ram: ['loai', 'dung_luong', 'bus', 'rgb', 'chieu_cao'],
  storage: ['dung_luong', 'chuan', 'ket_noi', 'doc', 'ghi', 'toc_do'],
  mainboard: ['socket', 'chipset', 'ram', 'kich_thuoc', 'khe_m2', 'wifi', 'wifi_chuan'],
  psu: ['cong_suat', 'chuan', 'modular', 'cong_16pin'],
  cooling: [
    'loai',
    'socket',
    'tdp_toi_da',
    'radiator',
    'quat',
    'kich_thuoc',
    'so_luong',
    'khoi_luong',
  ],
  keyboard: [
    'layout',
    'loai',
    'switch',
    'ket_noi',
    'hot_swap',
    'keycap',
    'khung',
    'phim_macro',
    'ung_dung_tuy_bien',
    'sac',
  ],
  mouse: ['cam_bien', 'dpi', 'so_nut', 'ket_noi', 'trong_luong', 'pin', 'sac'],
  monitor: [
    'kich_thuoc',
    'do_phan_giai',
    'tan_so',
    'tam_nen',
    'thoi_gian_phan_hoi',
    'do_cong',
    'mau',
    'ket_noi',
    'usb_c',
    'trong_luong',
  ],
  headset: ['kieu', 'ket_noi', 'driver', 'mic', 'chong_on', 'pin', 'trong_luong'],
  accessory: ['loai', 'kich_thuoc', 'kich_thuoc_toi_da', 'cong', 'chuan', 'chieu_dai', 'quat'],
};

/** Một thông số đã có nhãn và giá trị để hiện (ô thông số, panel thông số) */
export interface SpecEntry {
  key: string;
  label: string;
  value: string;
}

/**
 * Các thông số của một sản phẩm, xếp theo `SPEC_ORDER` của loại hàng; khoá không có trong bảng
 * xếp sau, theo thứ tự trả về. Bỏ dòng không có giá trị hiện được (`specValue`).
 */
export function specEntries(
  category: ProductCategory,
  specs: Readonly<Record<string, unknown>> | undefined,
): SpecEntry[] {
  if (!specs) return [];
  const order = SPEC_ORDER[category] ?? [];
  const rank = (key: string) => {
    const i = order.indexOf(key);
    return i === -1 ? order.length : i;
  };
  // sort ổn định: khoá lạ cùng hạng giữ thứ tự trả về
  return Object.entries(specs)
    .flatMap(([key, raw]) => {
      const value = specValue(raw);
      return value === undefined ? [] : [{ key, label: SPEC_LABELS[key] ?? key, value }];
    })
    .sort((a, b) => rank(a.key) - rank(b.key));
}
