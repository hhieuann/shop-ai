/**
 * Dữ liệu và luật của form thêm, sửa sản phẩm admin (pages/admin-san-pham.md mục 3, catalog.md
 * BR-11, BR-12). Hàm thuần để test không cần React.
 */
import type {
  AdminProduct,
  AdminProductCreate,
  AdminProductUpdate,
  ProductCategory,
} from '../../../shared/api/types';
import { SPEC_ORDER } from '../../catalog/lib/specLabels';
import { PRODUCT_TEMPLATES } from './productTemplates';

/** Giá trị đang nhập; số để dạng chuỗi như trong ô nhập */
export interface ProductFormValues {
  readonly name: string;
  readonly brand: string;
  readonly price: string;
  readonly stock: string;
  readonly description: string;
  readonly imageUrl: string;
  /** Công tắc "Đang bán": bật là ACTIVE, tắt là INACTIVE */
  readonly active: boolean;
  /** Mọi khoá theo SPEC_ORDER của loại; ô trống thì không lưu */
  readonly specs: Readonly<Record<string, string>>;
}

/** Tên ô có thể báo lỗi: trường chính hoặc `specs.<khoá>` như `errors[].field` của API */
export type ProductFormErrors = Partial<Record<string, string>>;

export const LIMITS = {
  name: 150,
  brand: 50,
  description: 1000,
  imageUrl: 500,
  specValue: 100,
  maxPrice: 1_000_000_000,
  maxStock: 9999,
} as const;

/** Mọi ô thông số của loại, giữ giá trị đã có (khoá lạ của dữ liệu cũ vẫn giữ để không mất) */
function specFields(
  category: ProductCategory,
  values: Readonly<Record<string, unknown>> = {},
): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const key of SPEC_ORDER[category]) fields[key] = '';
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === 'string' || typeof value === 'number') fields[key] = String(value);
  }
  return fields;
}

/** Form trống của một loại (nút "Xoá mẫu") */
export function emptyForm(category: ProductCategory): ProductFormValues {
  return {
    name: '',
    brand: '',
    price: '',
    stock: '',
    description: '',
    imageUrl: '',
    active: true,
    specs: specFields(category),
  };
}

/** Điền mẫu của loại: hãng, mô tả, thông số; tên, giá, tồn kho, ảnh để trống (mục 4) */
export function fromTemplate(category: ProductCategory): ProductFormValues {
  const template = PRODUCT_TEMPLATES[category];
  return {
    ...emptyForm(category),
    brand: template.brand,
    description: template.description,
    specs: specFields(category, template.specs),
  };
}

/** Form của một sản phẩm có sẵn (trang sửa) */
export function fromProduct(product: AdminProduct): ProductFormValues {
  return {
    name: product.name,
    brand: product.brand,
    price: String(product.price),
    stock: String(product.stock),
    description: product.description,
    imageUrl: product.imageUrl ?? '',
    active: product.status === 'ACTIVE',
    specs: specFields(product.category, product.specs),
  };
}

/**
 * "Sao chép từ sản phẩm có sẵn" và "Nhân bản" (`?from=`): điền mọi trường trừ tên, giá, tồn kho,
 * ảnh (các ô này để trống cho admin nhập, mục 3)
 */
export function copyFrom(product: AdminProduct): ProductFormValues {
  return { ...fromProduct(product), name: '', price: '', stock: '', imageUrl: '' };
}

/** Giá nhập có thể có dấu chấm, phẩy, khoảng trắng ngăn nghìn; sai dạng thì NaN */
export function parseAmount(text: string): number {
  const digits = text.replace(/[.,\s]/g, '');
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

/** Hiện giá có dấu chấm ngăn nghìn khi rời ô */
export function formatAmount(text: string): string {
  const value = parseAmount(text);
  return Number.isNaN(value) ? text : value.toLocaleString('vi-VN');
}

const HTTPS_URL = /^https:\/\/\S+$/;

/** Kiểm ở web khớp catalog.md BR-11; chuỗi bỏ khoảng trắng hai đầu trước khi kiểm */
export function validateProduct(values: ProductFormValues): ProductFormErrors {
  const errors: ProductFormErrors = {};
  const text = (field: 'name' | 'brand' | 'description', label: string, max: number) => {
    const value = values[field].trim();
    if (!value) errors[field] = `Nhập ${label}.`;
    else if (value.length > max) errors[field] = `${label} tối đa ${max} ký tự.`;
  };
  text('name', 'tên sản phẩm', LIMITS.name);
  text('brand', 'hãng', LIMITS.brand);
  text('description', 'mô tả', LIMITS.description);

  const price = parseAmount(values.price);
  if (!values.price.trim()) errors.price = 'Nhập giá bán.';
  else if (Number.isNaN(price) || price < 1 || price > LIMITS.maxPrice) {
    errors.price = 'Giá là số nguyên từ 1 tới 1.000.000.000.';
  }
  const stock = parseAmount(values.stock);
  if (!values.stock.trim()) errors.stock = 'Nhập tồn kho.';
  else if (Number.isNaN(stock) || stock > LIMITS.maxStock) {
    errors.stock = 'Tồn kho là số nguyên từ 0 tới 9999.';
  }

  const imageUrl = values.imageUrl.trim();
  if (imageUrl && (!HTTPS_URL.test(imageUrl) || imageUrl.length > LIMITS.imageUrl)) {
    errors.imageUrl = 'Đường dẫn ảnh bắt đầu bằng https:// và tối đa 500 ký tự.';
  }
  for (const [key, raw] of Object.entries(values.specs)) {
    if (raw.trim().length > LIMITS.specValue) {
      errors[`specs.${key}`] = `Tối đa ${LIMITS.specValue} ký tự.`;
    }
  }
  return errors;
}

/** Thông số có giá trị (ô trống không lưu) */
function filledSpecs(specs: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(specs)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => value !== ''),
  );
}

/** Body POST /api/v1/admin/products; gọi sau khi validateProduct không còn lỗi */
export function toCreateBody(
  category: ProductCategory,
  values: ProductFormValues,
): AdminProductCreate {
  const specs = filledSpecs(values.specs);
  const imageUrl = values.imageUrl.trim();
  return {
    name: values.name.trim(),
    category,
    brand: values.brand.trim(),
    price: parseAmount(values.price),
    stock: parseAmount(values.stock),
    status: values.active ? 'ACTIVE' : 'INACTIVE',
    description: values.description.trim(),
    ...(imageUrl && { imageUrl }),
    ...(Object.keys(specs).length > 0 && { specs }),
  };
}

function sameSpecs(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * Body PATCH (catalog.md BR-12): chỉ trường đã đổi so với bản đang sửa, kèm `updatedAt`; đổi tồn
 * kho thì kèm `expectedStock`; xoá trống ô ảnh thì gửi `imageUrl: null`. Không đổi gì thì `null`.
 */
export function toPatchBody(
  original: AdminProduct,
  values: ProductFormValues,
): AdminProductUpdate | null {
  const body: Record<string, unknown> = {};
  const name = values.name.trim();
  if (name !== original.name) body.name = name;
  const brand = values.brand.trim();
  if (brand !== original.brand) body.brand = brand;
  const description = values.description.trim();
  if (description !== original.description) body.description = description;
  const price = parseAmount(values.price);
  if (price !== original.price) body.price = price;
  const stock = parseAmount(values.stock);
  if (stock !== original.stock) {
    body.stock = stock;
    body.expectedStock = original.stock;
  }
  const status = values.active ? 'ACTIVE' : 'INACTIVE';
  if (status !== original.status) body.status = status;
  const imageUrl = values.imageUrl.trim();
  if (imageUrl !== (original.imageUrl ?? '')) body.imageUrl = imageUrl === '' ? null : imageUrl;
  const specs = filledSpecs(values.specs);
  if (!sameSpecs(specs, original.specs ?? {})) body.specs = specs;

  if (Object.keys(body).length === 0) return null;
  return { updatedAt: original.updatedAt, ...body } as AdminProductUpdate;
}

/** Hai form có giống nhau không (để biết có thay đổi chưa lưu) */
export function sameForm(a: ProductFormValues, b: ProductFormValues): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
