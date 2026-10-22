/**
 * Nhãn có dấu cho khoá `specs` (khoá là mã tiếng Việt không dấu, chi-tiet-san-pham.md mục 8).
 * Khoá chưa có nhãn thì hiện nguyên mã.
 */
const SPEC_LABELS: Readonly<Record<string, string>> = {
  bus: 'Bus',
  cam_bien: 'Cảm biến',
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
  do_phan_giai: 'Độ phân giải',
  doc: 'Tốc độ đọc',
  dpi: 'DPI',
  dung_luong: 'Dung lượng',
  ghi: 'Tốc độ ghi',
  gpu: 'GPU',
  hot_swap: 'Hot-swap',
  ket_noi: 'Kết nối',
  khoi_luong: 'Khối lượng',
  kich_thuoc: 'Kích thước',
  kich_thuoc_toi_da: 'Kích thước tối đa',
  layout: 'Layout',
  loai: 'Loại',
  man_hinh: 'Màn hình',
  mau: 'Màu',
  mic: 'Micro',
  modular: 'Modular',
  nguon_de_xuat: 'Nguồn đề xuất',
  nhan_luong: 'Nhân / luồng',
  pin: 'Pin',
  quat: 'Quạt',
  radiator: 'Radiator',
  ram: 'RAM',
  rgb: 'RGB',
  so_luong: 'Số lượng',
  socket: 'Socket',
  ssd: 'SSD',
  switch: 'Switch',
  tam_nen: 'Tấm nền',
  tan_so: 'Tần số quét',
  tdp: 'TDP',
  tdp_toi_da: 'TDP tối đa',
  toc_do: 'Tốc độ',
  trong_luong: 'Trọng lượng',
  vram: 'VRAM',
  wifi: 'Wi-Fi',
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

/** Các dòng của bảng "Thông số kỹ thuật", giữ thứ tự khoá như trong dữ liệu */
export function specRows(
  specs: Readonly<Record<string, unknown>> | undefined,
): { label: string; value: string }[] {
  if (!specs) return [];
  return Object.entries(specs).flatMap(([key, raw]) => {
    const value = specValue(raw);
    return value === undefined ? [] : [{ label: SPEC_LABELS[key] ?? key, value }];
  });
}
