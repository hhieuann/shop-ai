import type { Product } from './domain/product.js';

/** Use case chỉ biết interface này; adapter DynamoDB nằm trong infra/. */
export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
}
