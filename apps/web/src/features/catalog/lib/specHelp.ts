/**
 * Câu giải thích từng thông số trong panel (design-system §9.24). Khoá `loại.khoá` là nghĩa riêng theo
 * loại hàng, khoá `khoá` là nghĩa chung; tra `loại.khoá` trước rồi `khoá` (specHelp).
 * Câu chỉ nói thông số là gì và ghi bằng đơn vị nào: không khuyên chọn, không nói linh kiện nào lắp được
 * với nhau (catalog BR-06), không nhắc hãng, không phụ thuộc giá trị của sản phẩm.
 */
const SPEC_HELP: Readonly<Record<string, string>> = {
  // Nghĩa chung
  cpu: 'Bộ xử lý trung tâm, chạy hệ điều hành và mọi ứng dụng. Tên mẫu cho biết dòng chip, đời chip và phân khúc.',
  chip: 'Chip gộp bộ xử lý, nhân đồ hoạ và bộ nhớ trong một khối. Tên mẫu cho biết đời chip.',
  gpu: 'Bộ xử lý đồ hoạ, lo phần hình ảnh: game, dựng video, phần mềm 3D. Số GB đi kèm là bộ nhớ riêng của nhân đồ hoạ (VRAM).',
  ram: 'Bộ nhớ tạm cho các ứng dụng đang mở. Dung lượng ghi bằng GB; DDR4, DDR5 là thế hệ RAM.',
  ssd: 'Ổ lưu trữ thể rắn chứa hệ điều hành, phần mềm và tệp. Dung lượng ghi bằng GB hoặc TB.',
  man_hinh:
    'Kích thước đường chéo màn hình (inch), độ phân giải (FHD là 1920×1080) và tần số quét (Hz, số lần màn hình vẽ lại hình mỗi giây).',
  trong_luong: 'Khối lượng của sản phẩm theo thông số của hãng.',
  socket: 'Kiểu chân cắm của CPU trên bo mạch chủ, ví dụ LGA1700 hay AM5.',
  nhan_luong: 'Số nhân và số luồng xử lý, viết dạng nhân/luồng: 10/16 là 10 nhân, 16 luồng.',
  xung_toi_da: 'Tốc độ xung nhịp cao nhất CPU đạt được khi tự tăng tốc, đo bằng GHz.',
  tdp: 'Công suất nhiệt thiết kế do hãng công bố, đo bằng W: lượng nhiệt cần giải toả khi chip chạy ở mức tải thiết kế.',
  vram: 'Bộ nhớ riêng của card đồ hoạ, chứa hình ảnh và texture đang hiển thị. Ghi dung lượng (GB) và loại bộ nhớ (GDDR6, GDDR6X).',
  nguon_de_xuat: 'Công suất bộ nguồn mà hãng ghi trong thông số của card, tính cho cả máy.',
  cong_cap: 'Đầu cắm điện phụ trên card, nối bằng dây từ bộ nguồn; 1x 8-pin là một đầu 8 chân.',
  kich_thuoc: 'Kích thước theo thông số của hãng.',
  loai: 'Loại sản phẩm theo cách hãng phân loại.',
  dung_luong: 'Dung lượng của sản phẩm, ghi bằng GB hoặc TB.',
  bus: 'Tốc độ truyền dữ liệu của RAM, ghi bằng MHz.',
  rgb: 'Sản phẩm có đèn LED đổi màu hay không.',
  chuan: 'Chuẩn kỹ thuật mà hãng ghi cho sản phẩm.',
  doc: 'Tốc độ đọc tuần tự cao nhất do hãng công bố, đo bằng MB/s.',
  ghi: 'Tốc độ ghi tuần tự cao nhất do hãng công bố, đo bằng MB/s.',
  toc_do: 'Tốc độ quay của đĩa trong ổ cứng cơ, đo bằng vòng mỗi phút (rpm).',
  ket_noi: 'Các cách kết nối sản phẩm với máy tính hoặc thiết bị khác.',
  chipset:
    'Chip điều khiển trên bo mạch chủ, quyết định số cổng, số khe mở rộng và các tính năng của bo mạch.',
  wifi: 'Bo mạch có sẵn Wi-Fi hay không.',
  cong_suat: 'Công suất định mức của bộ nguồn, đo bằng W.',
  modular:
    'Dây của bộ nguồn có tháo rời được không: Full là tháo được mọi dây, Semi là tháo được một phần, Không là dây gắn liền.',
  cong_16pin: 'Bộ nguồn có sẵn đầu cấp điện 16 chân cho card đồ hoạ hay không.',
  tdp_toi_da: 'Mức nhiệt cao nhất mà hãng ghi cho bộ tản nhiệt, đo bằng W.',
  radiator: 'Chiều dài két tản nhiệt của tản nước, đo bằng mm (120, 240, 360…).',
  so_luong: 'Số lượng trong một hộp.',
  khoi_luong: 'Khối lượng tịnh trong gói, theo thông số của hãng.',
  layout: 'Bố cục bàn phím: số phím và cách sắp xếp, ví dụ TKL là bỏ cụm phím số bên phải.',
  switch: 'Loại công tắc dưới mỗi phím của bàn phím cơ, quyết định cảm giác gõ và tiếng phím.',
  hot_swap: 'Thay được switch mà không cần hàn hay không.',
  cam_bien: 'Cảm biến đọc chuyển động của chuột.',
  dpi: 'Độ nhạy của chuột: số điểm con trỏ đi được khi chuột di chuyển một inch.',
  pin: 'Thời gian dùng một lần sạc theo thông số của hãng.',
  do_phan_giai: 'Số điểm ảnh theo chiều ngang × chiều dọc, ví dụ 2560x1440.',
  tan_so: 'Số lần màn hình vẽ lại hình mỗi giây, đo bằng Hz.',
  tam_nen: 'Công nghệ tấm nền của màn hình, ví dụ IPS, VA hay TN.',
  mau: 'Dải màu màn hình hiển thị được, so với một chuẩn màu như sRGB.',
  mic: 'Kiểu micro của tai nghe, ví dụ rời, thu gọn được hoặc khử ồn.',
  chong_on: 'Tai nghe có chống ồn chủ động hay không.',
  kich_thuoc_toi_da: 'Cỡ laptop lớn nhất mà hãng ghi cho sản phẩm, đo bằng inch.',
  cong: 'Các cổng có trên sản phẩm.',
  chieu_dai: 'Chiều dài của cáp.',
  quat: 'Đường kính quạt, đo bằng mm.',
  // Nghĩa riêng theo loại hàng
  'laptop.trong_luong': 'Khối lượng của máy theo thông số của hãng, đo bằng kg.',
  'mainboard.socket': 'Kiểu đế cắm CPU có trên bo mạch chủ.',
  'mainboard.ram': 'Thế hệ RAM của các khe cắm trên bo mạch, ví dụ DDR4 hoặc DDR5.',
  'mainboard.kich_thuoc': 'Chuẩn kích thước bo mạch chủ, ví dụ ATX hay mATX (Micro-ATX).',
  'cooling.socket': 'Các kiểu đế cắm CPU mà hãng ghi kèm bộ gá của tản nhiệt.',
  'cooling.loai':
    'Kiểu tản nhiệt: tản khí dùng lá tản và quạt; tản nước AIO dùng bơm, ống dẫn và két nước kín.',
  'cooling.kich_thuoc': 'Kích thước quạt theo thông số của hãng, đo bằng mm.',
  'gpu.kich_thuoc': 'Chiều dài của card, đo bằng mm.',
  'monitor.kich_thuoc': 'Kích thước đường chéo màn hình, đo bằng inch.',
  'monitor.ket_noi': 'Các cổng nhận tín hiệu hình có trên màn hình.',
  'ram.loai': 'Thế hệ RAM, ví dụ DDR4 hoặc DDR5.',
  'ram.dung_luong': 'Tổng dung lượng của bộ RAM kèm số thanh: 16GB (2x8GB) là hai thanh 8GB.',
  'storage.dung_luong': 'Dung lượng lưu trữ của ổ, ghi bằng GB hoặc TB.',
  'storage.chuan': 'Kiểu khe cắm và giao tiếp của ổ, ví dụ M.2 NVMe PCIe 4.0.',
  'storage.ket_noi': 'Cổng nối ổ cứng gắn ngoài với máy tính.',
  'psu.chuan':
    'Chứng nhận hiệu suất 80 Plus (Bronze, Gold…): tỉ lệ điện năng bộ nguồn chuyển thành điện cho máy, phần còn lại thành nhiệt.',
  'keyboard.loai': 'Kiểu bàn phím theo cơ chế phím, ví dụ phím màng hay phím cơ.',
  'keyboard.ket_noi':
    'Cách bàn phím kết nối với máy: dây USB, sóng 2.4GHz qua đầu thu hoặc Bluetooth.',
  'mouse.ket_noi': 'Cách chuột kết nối với máy: dây USB, sóng 2.4GHz qua đầu thu hoặc Bluetooth.',
  'mouse.trong_luong': 'Khối lượng của chuột, đo bằng g.',
  'headset.ket_noi':
    'Cách tai nghe kết nối với máy: jack 3.5mm, USB, sóng 2.4GHz qua đầu thu hoặc Bluetooth.',
  'headset.trong_luong': 'Khối lượng của tai nghe, đo bằng g.',
  'accessory.loai': 'Nhóm phụ kiện, ví dụ balo, túi chống sốc, hub USB-C hay cáp.',
  'accessory.kich_thuoc':
    'Kích thước theo thông số của hãng: với balo và túi là cỡ laptop ghi trên sản phẩm (inch), với lót chuột là dài × rộng.',
  'accessory.chuan': 'Chuẩn tín hiệu của cáp, ví dụ HDMI 2.1 hay DisplayPort 1.4.',
  'accessory.cong': 'Các cổng có trên hub.',
};

/** Câu giải thích của một thông số: `loại.khoá` rồi `khoá`; không có thì undefined */
export function specHelp(category: string, key: string): string | undefined {
  return SPEC_HELP[`${category}.${key}`] ?? SPEC_HELP[key];
}
