import { ProductNotFoundError } from '../domain/errors.js';
import { isVisibleToCustomers, type Product } from '../domain/product.js';
import type { ProductRepository } from '../ports.js';

export interface GetProductDeps {
  readonly products: ProductRepository;
}

export async function getProduct(
  deps: GetProductDeps,
  input: { readonly productId: string },
): Promise<Product> {
  const product = await deps.products.findById(input.productId);
  // BR-04: sản phẩm đã ẩn trả 404 giống như không có, không cho khách biết nó tồn tại
  if (!product || !isVisibleToCustomers(product)) {
    throw new ProductNotFoundError(input.productId);
  }
  return product;
}
