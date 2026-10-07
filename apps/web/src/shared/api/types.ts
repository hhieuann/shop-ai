/**
 * Type của API, lấy từ `schema.d.ts` do openapi-typescript sinh ra từ `contracts/openapi.yaml` (ADR-0011).
 * Không sửa `schema.d.ts` bằng tay: đổi OpenAPI rồi chạy `pnpm --filter web generate:types`.
 * Hợp đồng đổi mà web chưa theo → TypeScript báo lỗi ngay, không đợi tới lúc chạy.
 */
import type { components, operations } from './schema';

type Schemas = components['schemas'];

export type ProductCategory = Schemas['ProductCategory'];
export type ProductStatus = Schemas['ProductStatus'];
export type ProductSummary = Schemas['ProductSummary'];
export type Product = Schemas['Product'];
export type ProductListResponse =
  operations['listProducts']['responses'][200]['content']['application/json'];
export type ProductSort = NonNullable<
  NonNullable<operations['listProducts']['parameters']['query']>['sort']
>;

export type Cart = Schemas['Cart'];
export type CartItem = Schemas['CartItem'];
export type CartProblem = Schemas['CartProblem'];
export type MergeCartResult = Schemas['MergeCartResult'];
export type MergeAdjustment = Schemas['MergeAdjustment'];

export type ShippingAddress = Schemas['ShippingAddress'];
export type OrderStatus = Schemas['OrderStatus'];
export type OrderItem = Schemas['OrderItem'];
export type OrderSummary = Schemas['OrderSummary'];
export type Order = Schemas['Order'];
export type OrderListResponse =
  operations['listOrders']['responses'][200]['content']['application/json'];
export type CreateOrderRequest =
  operations['createOrder']['requestBody']['content']['application/json'];
export type OrderProblem = Schemas['OrderProblem'];

export type FieldError = NonNullable<Schemas['Problem']['errors']>[number];
export type InvalidItem = NonNullable<OrderProblem['invalidItems']>[number];
export type ChangedItem = NonNullable<OrderProblem['changedItems']>[number];
