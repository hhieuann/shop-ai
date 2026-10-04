const vnd = new Intl.NumberFormat('vi-VN');

/** 24990000 → "24.990.000₫" (dấu chấm ngăn nghìn, ₫ sau số, không cách) */
export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}₫`;
}

/** Bản đọc cho trình đọc màn hình: "24.990.000 đồng" */
export function spokenVnd(amount: number): string {
  return `${vnd.format(amount)} đồng`;
}
