const vnd = new Intl.NumberFormat('vi-VN');

/** 24990000 → "24.990.000₫" (dấu chấm ngăn nghìn, ₫ sau số, không cách) */
export function formatVnd(amount: number): string {
  return `${vnd.format(amount)}₫`;
}

const dateTime = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  // h23 thay vì hour12: false: một số bản Chrome in nửa đêm thành 24:xx
  hourCycle: 'h23',
});

/** "2026-11-06T06:42:00Z" → "06/11/2026 13:42" (giờ Việt Nam, không phụ thuộc múi giờ máy) */
export function formatDateTime(iso: string): string {
  const parts = Object.fromEntries(
    dateTime.formatToParts(new Date(iso)).map((p) => [p.type, p.value]),
  );
  return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}`;
}

/** Bản đọc cho trình đọc màn hình: "24.990.000 đồng" */
export function spokenVnd(amount: number): string {
  return `${vnd.format(amount)} đồng`;
}
