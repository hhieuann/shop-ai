/**
 * Nạp danh sách sản phẩm từ file JSON vào bảng products (sandbox, dev, staging; không bao giờ prod).
 * CLI ở scripts/seed-products.ts; file này chứa phần kiểm file và ghi bảng để test được.
 */
import { BatchWriteCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import type { Product } from '../domain/product.js';
import { productItemSchema, toProductItem } from './dynamoProductRepository.js';

/** BatchWriteItem nhận tối đa 25 item mỗi lần. */
export const BATCH_SIZE = 25;

/** ULID: 26 ký tự Crockford base32 (không có I, L, O, U). */
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;

const seedFileSchema = z.object({
  /** Ghi chú cho người đọc file, script bỏ qua. */
  _note: z.string().optional(),
  products: z
    .array(
      productItemSchema
        .extend({ productId: z.string().regex(ULID, 'productId phải là ULID 26 ký tự') })
        // Trường gõ sai tên (vd. "prcie") bị báo lỗi thay vì lặng lẽ bỏ qua
        .strict(),
    )
    .min(1, 'File không có sản phẩm nào'),
});

export class SeedFileError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      `File sản phẩm có ${problems.length} lỗi:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    this.name = 'SeedFileError';
  }
}

/** Kiểm toàn bộ file trước khi ghi: sai một sản phẩm thì không ghi gì cả. */
export function parseSeedFile(json: unknown): Product[] {
  const result = seedFileSchema.safeParse(json);
  if (!result.success) {
    throw new SeedFileError(
      result.error.issues.map((issue) => `${issue.path.join('.') || '(gốc)'}: ${issue.message}`),
    );
  }

  const products = result.data.products;
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  products.forEach((product, index) => {
    const first = seen.get(product.productId);
    if (first === undefined) seen.set(product.productId, index);
    else
      duplicates.push(
        `products.${index}.productId: trùng với products.${first} (${product.productId})`,
      );
  });
  if (duplicates.length > 0) throw new SeedFileError(duplicates);

  return products;
}

/**
 * Chặn chạy nhầm vào prod: tên bảng prod có tiền tố shop-prd (infra/lib/config.ts).
 * Chỉ xét "prd"/"prod" là một đoạn riêng giữa dấu - hoặc _, vì tên bảng nào cũng có chữ "Products".
 */
export function assertNotProductionTable(tableName: string): void {
  if (/(^|[-_])(prd|prod)([-_]|$)/i.test(tableName)) {
    throw new Error(`Không nạp dữ liệu demo vào bảng prod: ${tableName}`);
  }
}

export interface WriteProductsOptions {
  /** Số lần thử lại phần DynamoDB chưa xử lý (UnprocessedItems) của mỗi lô */
  readonly maxRetries?: number;
  /** Chờ giữa các lần thử lại; test truyền hàm không chờ */
  readonly sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Ghi theo lô 25 item. PutRequest ghi đè theo productId, nên chạy lại cùng file không nhân đôi.
 * Mỗi item kèm categoryStatus để hiện trong GET /api/v1/products.
 */
export async function writeProducts(
  db: DynamoDBDocumentClient,
  tableName: string,
  products: readonly Product[],
  options: WriteProductsOptions = {},
): Promise<number> {
  const { maxRetries = 5, sleep = defaultSleep } = options;
  assertNotProductionTable(tableName);

  for (let start = 0; start < products.length; start += BATCH_SIZE) {
    let requests: WriteRequests = products
      .slice(start, start + BATCH_SIZE)
      .map((product) => ({ PutRequest: { Item: toProductItem(product) } }));

    for (let attempt = 0; requests.length > 0; attempt += 1) {
      if (attempt > maxRetries) {
        throw new Error(
          `Còn ${requests.length} sản phẩm chưa ghi được sau ${maxRetries} lần thử lại`,
        );
      }
      if (attempt > 0) await sleep(100 * 2 ** (attempt - 1));

      const { UnprocessedItems } = await db.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: requests } }),
      );
      requests = UnprocessedItems?.[tableName] ?? [];
    }
  }

  return products.length;
}

/** Danh sách PutRequest của một bảng trong BatchWriteCommand */
type WriteRequests = NonNullable<
  ConstructorParameters<typeof BatchWriteCommand>[0]['RequestItems']
>[string];
