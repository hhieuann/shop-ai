import type { RecProduct, RecType } from './domain/recs.js';

/** Use case chỉ biết interface này; adapter đọc bảng `recs` nằm trong infra/. */
export interface RecsStore {
  /** Phiên bản đang bật của loại gợi ý (con trỏ `META / ACTIVE#<recType>`); null khi pipeline chưa chạy */
  activeVersion(recType: RecType): Promise<number | null>;
  /** Mã sản phẩm của anchor trong phiên bản đó, đã sắp theo hạng; rỗng khi anchor không có dòng nào */
  rankedProductIds(recType: RecType, anchor: string, version: number): Promise<string[]>;
}

/**
 * Thông tin sản phẩm mới nhất (tồn kho, trạng thái) của module catalog để lọc và trả ra.
 * Recommendation không import code của catalog (ADR-0009); adapter đọc bảng products, chỉ đọc
 * (ngoại lệ ghi ở ADR-0017).
 */
export interface ProductCatalog {
  /** Sản phẩm không còn trong catalog thì không có trong Map trả về */
  findMany(productIds: readonly string[]): Promise<Map<string, RecProduct>>;
}

/**
 * Băm userId giống module events (events.md mục 2) để tìm dòng `FOR_YOU#<userIdHash>`.
 * Adapter dùng hàm băm chung trong shared/ khi Nhân tách xong.
 */
export interface UserIdHasher {
  hash(userId: string): Promise<string>;
}
