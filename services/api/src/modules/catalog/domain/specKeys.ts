import type { ProductCategory } from './product.js';

/**
 * Khoá thông số được phép theo loại hàng (catalog.md BR-11). Chép từ `SPEC_ORDER` của web
 * (apps/web/src/features/catalog/lib/specLabels.ts) vì module API không import code web.
 * Thêm khoá mới thì sửa cả hai nơi; specKeys.test.ts đối chiếu với khoá của 104 món trong
 * seed/catalog/products.json để bắt chỗ lệch.
 */
export const SPEC_KEYS: Readonly<Record<ProductCategory, readonly string[]>> = {
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

/** Khoá không thuộc loại hàng, theo thứ tự gửi lên; rỗng là hợp lệ */
export function unknownSpecKeys(
  category: ProductCategory,
  specs: Readonly<Record<string, unknown>>,
): string[] {
  const allowed = new Set(SPEC_KEYS[category]);
  return Object.keys(specs).filter((key) => !allowed.has(key));
}
