/**
 * Tên đơn hiện cho khách (pages/don-hang.md mục 1): tên món đầu, đơn nhiều món thêm
 * "và N sản phẩm khác". `itemCount` là số loại sản phẩm (số dòng), không phải tổng số lượng.
 */
export interface OrderTitleParts {
  /** Tên món đầu (thứ tự lúc đặt) */
  name: string;
  /** "và N sản phẩm khác"; không có khi đơn chỉ 1 món */
  others?: string;
}

/** Hai phần của tên đơn, để trang danh sách chỉ cắt "…" phần tên món */
export function orderTitleParts(firstName: string, itemCount: number): OrderTitleParts {
  if (itemCount <= 1) return { name: firstName };
  return { name: firstName, others: `và ${itemCount - 1} sản phẩm khác` };
}

/** Tên đơn một chuỗi (trang chi tiết, hộp thoại huỷ đơn) */
export function orderTitle(firstName: string, itemCount: number): string {
  const { name, others } = orderTitleParts(firstName, itemCount);
  return others ? `${name} ${others}` : name;
}
