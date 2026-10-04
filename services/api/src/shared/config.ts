/** Đọc biến môi trường bắt buộc. Thiếu thì dừng ngay lúc Lambda khởi động, không để lỗi khó hiểu về sau. */
export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Thiếu biến môi trường ${name}`);
  return value;
}
