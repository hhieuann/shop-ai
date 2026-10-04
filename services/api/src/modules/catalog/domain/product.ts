/** Sản phẩm, theo docs/business/catalog.md và schema Product trong contracts/openapi.yaml. */
export type ProductStatus = 'ACTIVE' | 'INACTIVE';

export interface Product {
  /** ULID */
  readonly productId: string;
  readonly name: string;
  readonly category: string;
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

/** BR-04: sản phẩm INACTIVE không hiển thị cho khách, kể cả ở trang chi tiết. */
export function isVisibleToCustomers(product: Pick<Product, 'status'>): boolean {
  return product.status === 'ACTIVE';
}
