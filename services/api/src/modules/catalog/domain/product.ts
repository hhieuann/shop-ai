/** Sản phẩm, theo docs/business/catalog.md và schema Product trong contracts/openapi.yaml. */
export type ProductStatus = 'ACTIVE' | 'INACTIVE';

/** 13 loại hàng, khớp enum ProductCategory trong contracts/openapi.yaml (catalog.md BR-02). */
export const PRODUCT_CATEGORIES = [
  'laptop',
  'cpu',
  'gpu',
  'ram',
  'storage',
  'mainboard',
  'psu',
  'cooling',
  'keyboard',
  'mouse',
  'monitor',
  'headset',
  'accessory',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export interface Product {
  /** ULID */
  readonly productId: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly brand: string;
  /** Giá niêm yết, số nguyên VND (BR-05) */
  readonly price: number;
  readonly stock: number;
  readonly status: ProductStatus;
  readonly description: string;
  readonly imageUrl?: string;
  /** Thông số kỹ thuật tuỳ theo loại, vd. { vram: '12GB GDDR6X' } */
  readonly specs?: Readonly<Record<string, unknown>>;
  /** ISO 8601 UTC */
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Thông tin rút gọn cho danh sách, khớp schema ProductSummary trong OpenAPI. */
export interface ProductSummary {
  readonly productId: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly brand: string;
  readonly price: number;
  readonly stock: number;
  readonly status: ProductStatus;
  readonly imageUrl?: string;
}

/** BR-04: sản phẩm INACTIVE không hiển thị cho khách, kể cả ở trang chi tiết. */
export function isVisibleToCustomers(product: Pick<Product, 'status'>): boolean {
  return product.status === 'ACTIVE';
}

/** BR-08: hết hàng vẫn hiển thị nhưng xếp cuối danh sách. */
export function isInStock(product: Pick<Product, 'stock'>): boolean {
  return product.stock > 0;
}

/** Chỉ lấy các trường của ProductSummary; trường nội bộ (vd. searchText) không lọt ra API. */
export function toSummary(product: Product): ProductSummary {
  const { productId, name, category, brand, price, stock, status, imageUrl } = product;
  return imageUrl === undefined
    ? { productId, name, category, brand, price, stock, status }
    : { productId, name, category, brand, price, stock, status, imageUrl };
}
