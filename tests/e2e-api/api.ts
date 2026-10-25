/**
 * Phần dùng chung của E2E API (hands-on-testing-guide.md mục 6): gọi API thật qua CloudFront và
 * đăng nhập Cognito bằng fetch, không cần SDK. Mọi giá trị lấy từ biến môi trường, không ghi cứng.
 */

/** true khi đủ BASE_URL và thông tin đăng nhập (vitest.config.ts kiểm); thiếu thì bỏ qua cả bộ */
export const ready = process.env.E2E_READY === '1';

const baseUrl = (process.env.E2E_BASE_URL ?? '').replace(/\/+$/, '');
const region = process.env.E2E_REGION ?? 'ap-southeast-1';
// Chỉ để chạy thử với Cognito giả ở máy; CI dùng endpoint thật của region
const cognitoEndpoint =
  process.env.COGNITO_ENDPOINT || `https://cognito-idp.${region}.amazonaws.com/`;

export interface ApiResponse {
  status: number;
  contentType: string;
  cacheControl: string;
  body: unknown;
}

/**
 * Gọi /api/v1/...; trả status, header cần kiểm và body đã parse (null khi rỗng hoặc không phải JSON).
 * `headers` cho header riêng của từng API, vd. Idempotency-Key khi đặt hàng.
 */
export async function call(
  path: string,
  {
    method = 'GET',
    token,
    body,
    headers: extraHeaders,
  }: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = { ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  return {
    status: res.status,
    contentType: res.headers.get('content-type') ?? '',
    cacheControl: res.headers.get('cache-control') ?? '',
    body: parseBody(text),
  };
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** InitiateAuth với USER_PASSWORD_AUTH qua app client E2E (chỉ có ở dev và staging) */
export async function initiateAuth(
  username: string,
  password: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(cognitoEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: process.env.COGNITO_CLIENT_ID,
      AuthParameters: { USERNAME: username, PASSWORD: password },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

/** Đăng nhập người dùng E2E, trả access token; lỗi thì ném kèm mã lỗi Cognito (không in mật khẩu) */
export async function signIn(): Promise<string> {
  const { status, body } = await initiateAuth(
    process.env.E2E_USERNAME ?? '',
    process.env.E2E_PASSWORD ?? '',
  );
  const token = (body.AuthenticationResult as { AccessToken?: string } | undefined)?.AccessToken;
  if (status !== 200 || !token) {
    throw new Error(`Đăng nhập người dùng E2E thất bại: ${status} ${String(body.__type ?? '')}`);
  }
  return token;
}

/** Bỏ dấu, chữ thường: "Chuột" → "chuot" (tìm kiếm không phân biệt dấu, catalog.md BR-03) */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export interface ProductSummary {
  productId: string;
  name: string;
  category: string;
  brand: string;
  price: number;
  stock: number;
  status: string;
}

export interface ProductList {
  items: ProductSummary[];
  nextCursor?: string | null;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  status: string;
}

export interface Cart {
  items: CartItem[];
  totalAmount: number;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface OrderSummary {
  orderId: string;
  status: OrderStatus;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

export interface OrderList {
  items: OrderSummary[];
  nextCursor?: string;
}

export interface Order {
  orderId: string;
  status: OrderStatus;
  items: { productId: string; name: string; price: number; quantity: number }[];
  totalAmount: number;
  shippingFee: number;
  shippingAddress: { fullName: string; phone: string; address: string; province: string };
  paymentMethod: string;
}
