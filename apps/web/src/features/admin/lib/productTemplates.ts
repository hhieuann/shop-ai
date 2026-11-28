/**
 * 13 mẫu điền sẵn khi admin thêm sản phẩm (pages/admin-san-pham.md mục 4): mỗi loại một mẫu, có
 * hãng gợi ý, tên ví dụ để làm placeholder, mô tả 2–3 câu theo giọng các món demo và đủ ô thông số
 * theo `SPEC_ORDER` của loại. Tên, giá, tồn kho, ảnh để trống cho admin tự nhập.
 */
import type { ProductCategory } from '../../../shared/api/types';

export interface ProductTemplate {
  readonly brand: string;
  /** Chỉ làm placeholder của ô tên, không điền vào ô */
  readonly namePlaceholder: string;
  readonly description: string;
  /** Đủ khoá theo SPEC_ORDER của loại, giá trị ví dụ */
  readonly specs: Readonly<Record<string, string>>;
}

export const PRODUCT_TEMPLATES: Readonly<Record<ProductCategory, ProductTemplate>> = {
  laptop: {
    brand: 'ASUS',
    namePlaceholder: 'Vd. Laptop ASUS TUF Gaming A15 (R7-7435HS, RTX 4050)',
    description:
      'Laptop 15.6 inch cho học tập, làm việc và chơi game ở 1080p. Màn tần số quét cao, pin đủ dùng cả buổi. Nên mua kèm chuột, balo 15.6 inch và đế tản nhiệt.',
    specs: {
      cpu: 'Ryzen 7 7735HS',
      chip: 'AMD Ryzen 7000',
      gpu: 'RTX 4050 6GB',
      ram: '16GB DDR5',
      ssd: '512GB NVMe',
      man_hinh: '15.6" FHD 144Hz',
      pin: '90Wh',
      trong_luong: '2.2kg',
    },
  },
  cpu: {
    brand: 'Intel',
    namePlaceholder: 'Vd. CPU Intel Core i5-14400F',
    description:
      'CPU cho PC gaming và làm việc tầm trung, đủ mạnh khi ghép với card đồ hoạ rời. Nên mua kèm mainboard đúng socket, RAM và tản nhiệt.',
    specs: {
      socket: 'LGA1700',
      nhan_luong: '10/16',
      xung_toi_da: '4.7GHz',
      bo_nho_dem: '20MB L3',
      tdp: '65W',
      do_hoa_tich_hop: 'Không',
      npu: 'Không',
      tan_kem_theo: 'Có',
    },
  },
  gpu: {
    brand: 'MSI',
    namePlaceholder: 'Vd. Card MSI GeForce RTX 4060 Ventus 2X 8GB',
    description:
      'Card đồ hoạ cho chơi game 1080p và 1440p, hỗ trợ DLSS và ray tracing. Kiểm chiều dài card với vỏ case trước khi mua. Nên mua kèm nguồn đúng công suất đề xuất.',
    specs: {
      kien_truc: 'Ada Lovelace',
      vram: '8GB GDDR6',
      giao_tiep: 'PCIe 4.0 x8',
      nguon_de_xuat: '550W',
      cong_cap: '1x 8-pin',
      kich_thuoc: '199mm',
    },
  },
  ram: {
    brand: 'Kingston',
    namePlaceholder: 'Vd. RAM Kingston Fury Beast 16GB (2x8GB) DDR5 5600MHz',
    description:
      'Kit RAM 2 thanh chạy kênh đôi cho PC gaming và làm việc. Chọn đúng loại DDR4 hoặc DDR5 theo mainboard. Nên mua kèm mainboard cùng chuẩn RAM.',
    specs: {
      loai: 'DDR5',
      dung_luong: '16GB (2x8GB)',
      bus: '5600MHz',
      rgb: 'Không',
      chieu_cao: '34.9mm',
    },
  },
  storage: {
    brand: 'Samsung',
    namePlaceholder: 'Vd. SSD Samsung 990 Pro 1TB NVMe M.2',
    description:
      'Ổ SSD NVMe cho máy gaming và làm việc, khởi động và tải game nhanh. Lắp vào khe M.2 đúng chuẩn PCIe trên mainboard.',
    specs: {
      dung_luong: '1TB',
      chuan: 'M.2 NVMe PCIe 4.0',
      ket_noi: 'M.2 2280',
      doc: '7000MB/s',
      ghi: '5000MB/s',
      toc_do: 'PCIe 4.0 x4',
    },
  },
  mainboard: {
    brand: 'ASUS',
    namePlaceholder: 'Vd. Mainboard ASUS Prime B760M-A WiFi D4',
    description:
      'Mainboard mATX cho CPU cùng socket, có sẵn WiFi. Hợp cấu hình làm việc và chơi game tầm trung. Nên mua kèm CPU đúng socket, RAM đúng chuẩn và SSD NVMe.',
    specs: {
      socket: 'LGA1700',
      chipset: 'B760',
      ram: 'DDR4',
      kich_thuoc: 'mATX',
      khe_m2: '2',
      wifi: 'Có',
      wifi_chuan: 'Wi-Fi 6',
    },
  },
  psu: {
    brand: 'Corsair',
    namePlaceholder: 'Vd. Nguồn Corsair RM750e 750W 80 Plus Gold',
    description:
      'Nguồn chuẩn 80 Plus Gold chạy êm, đủ cho cấu hình card đồ hoạ tầm trung đến cao. Nên mua kèm card đồ hoạ có nguồn đề xuất phù hợp.',
    specs: {
      cong_suat: '750W',
      chuan: '80 Plus Gold',
      modular: 'Full',
      cong_16pin: 'Có',
    },
  },
  cooling: {
    brand: 'Deepcool',
    namePlaceholder: 'Vd. Tản nhiệt khí Deepcool AK400',
    description:
      'Tản nhiệt cho CPU phổ thông, chạy êm, lắp đơn giản. Kiểm chiều cao tản với vỏ case. Nên mua kèm keo tản nhiệt nếu muốn thay keo có sẵn.',
    specs: {
      loai: 'Tản khí',
      socket: 'LGA1700, AM5, AM4',
      tdp_toi_da: '220W',
      radiator: 'Không',
      quat: '120mm',
      kich_thuoc: '155mm',
      so_luong: '1',
      khoi_luong: '660g',
    },
  },
  keyboard: {
    brand: 'Keychron',
    namePlaceholder: 'Vd. Bàn phím cơ Keychron K8 Pro',
    description:
      'Bàn phím cơ cho làm việc và chơi game, gõ êm, đổi switch không cần hàn. Nên mua kèm chuột và lót chuột lớn.',
    specs: {
      layout: 'TKL',
      loai: 'Bàn phím cơ',
      switch: 'Gateron Brown',
      ket_noi: 'Bluetooth, USB-C',
      hot_swap: 'Có',
      keycap: 'PBT',
      khung: 'Nhựa',
      phim_macro: 'Có',
      ung_dung_tuy_bien: 'QMK/VIA',
      sac: 'USB-C',
    },
  },
  mouse: {
    brand: 'Logitech',
    namePlaceholder: 'Vd. Chuột Logitech G304 Lightspeed',
    description:
      'Chuột cho chơi game và làm việc, cảm biến chính xác, cầm vừa tay. Nên mua kèm lót chuột lớn.',
    specs: {
      cam_bien: 'HERO 12K',
      dpi: '12000',
      so_nut: '6',
      ket_noi: 'Lightspeed',
      trong_luong: '99g',
      pin: '1x AA',
      sac: 'Không',
    },
  },
  monitor: {
    brand: 'LG',
    namePlaceholder: 'Vd. Màn hình LG UltraGear 27GR75Q 27" 2K 165Hz',
    description:
      'Màn hình cho chơi game và làm việc, màu đẹp, tần số quét cao. Chọn độ phân giải hợp với card đồ hoạ. Nên mua kèm cáp DisplayPort và giá treo màn hình.',
    specs: {
      kich_thuoc: '27"',
      do_phan_giai: '2560x1440',
      tan_so: '165Hz',
      tam_nen: 'IPS',
      thoi_gian_phan_hoi: '1ms GtG',
      do_cong: 'Phẳng',
      mau: '99% sRGB',
      ket_noi: 'HDMI 2.0, DisplayPort 1.4',
      usb_c: 'Không',
      trong_luong: '5.3kg',
    },
  },
  headset: {
    brand: 'HyperX',
    namePlaceholder: 'Vd. Tai nghe HyperX Cloud II',
    description:
      'Tai nghe cho chơi game và họp trực tuyến, đeo êm nhiều giờ, mic rõ tiếng. Nên mua kèm card âm thanh USB nếu máy có jack kém.',
    specs: {
      kieu: 'Over-ear',
      ket_noi: '3.5mm, USB',
      driver: '53mm',
      mic: 'Rời',
      chong_on: 'Không',
      pin: 'Không',
      trong_luong: '310g',
    },
  },
  accessory: {
    brand: 'Targus',
    namePlaceholder: 'Vd. Balo Targus 15.6 inch chống sốc',
    description:
      'Phụ kiện cho laptop và bàn làm việc, gọn và bền. Hợp sinh viên và dân văn phòng. Nên mua kèm laptop và chuột không dây.',
    specs: {
      loai: 'Balo',
      kich_thuoc: '15.6"',
      kich_thuoc_toi_da: '15.6"',
      cong: 'Không',
      chuan: 'Không',
      chieu_dai: 'Không',
      quat: 'Không',
    },
  },
};
