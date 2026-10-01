import { ProductNotFoundError } from '../domain/errors.js';
import { availabilityOf, type Availability } from '../domain/product.js';
import type { ProductRepository } from '../ports.js';

/** Dữ liệu trả cho web: có mức còn hàng, không lộ số tồn kho thật. */
export interface ProductView {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly priceVnd: number;
  readonly availability: Availability;
  readonly attributes: Readonly<Record<string, string | number>>;
}

export interface GetProductDeps {
  readonly products: ProductRepository;
}

export async function getProduct(
  deps: GetProductDeps,
  input: { readonly id: string },
): Promise<ProductView> {
  const product = await deps.products.findById(input.id);
  if (!product) throw new ProductNotFoundError(input.id);

  return {
    id: product.id,
    name: product.name,
    category: product.category,
    priceVnd: product.priceVnd,
    availability: availabilityOf(product),
    attributes: product.attributes,
  };
}
