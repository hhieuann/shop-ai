/** Sản phẩm trong catalog. Giá là số nguyên VND; thời gian là ISO 8601 UTC. */
export interface Product {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly priceVnd: number;
  readonly stock: number;
  /** Thông số theo từng loại linh kiện, vd. { socket: 'AM5' } hoặc { wattage: 750 } */
  readonly attributes: Readonly<Record<string, string | number>>;
  readonly updatedAt: string;
}

export type Availability = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

/** Còn từ mức này trở xuống thì báo sắp hết. Con số chốt trong nghiệp vụ catalog. */
export const LOW_STOCK_THRESHOLD = 5;

export function availabilityOf(product: Pick<Product, 'stock'>): Availability {
  if (product.stock <= 0) return 'OUT_OF_STOCK';
  if (product.stock <= LOW_STOCK_THRESHOLD) return 'LOW_STOCK';
  return 'IN_STOCK';
}
