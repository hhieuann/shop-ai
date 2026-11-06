/**
 * Đọc claim của access token Cognito mà JWT authorizer của HTTP API đã kiểm chữ ký và hạn dùng.
 * Dùng chung cho các module cần biết nhóm của người gọi (account: /me; ordering: API admin).
 */

/** Nhóm Cognito của quản trị shop (infra/lib/api-stack.ts, AdminGroup); chỉ An thêm người bằng tay */
export const ADMIN_GROUP = 'admin';

/**
 * Claim mảng `cognito:groups` tới Lambda dạng chuỗi "[admin customer]": HTTP API đổi mọi claim
 * thành chuỗi. Vẫn nhận dạng mảng phòng khi cách đưa claim thay đổi.
 */
export function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string') return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(/[\s,]+/)
    .filter(Boolean);
}

/** Người gọi có thuộc nhóm `group` không; không có claim thì không thuộc nhóm nào */
export function isInGroup(claims: Readonly<Record<string, unknown>> | undefined, group: string) {
  return parseGroups(claims?.['cognito:groups']).includes(group);
}
