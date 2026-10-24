import { BatchGetCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { logger } from '../../../shared/logger.js';
import { MAX_LINES, type ProductSnapshot } from '../domain/order.js';
import type { ProductCatalog } from '../ports.js';

/**
 * Đọc tên, giá, tồn kho, trạng thái mới nhất từ bảng products của catalog, CHỈ ĐỌC (ADR-0017, sửa 24/10):
 * - quyền IAM chỉ dynamodb:BatchGetItem trên ARN bảng (infra/lib/api-stack.ts, addOrdering);
 * - chỉ lấy các thuộc tính ordering cần (ProjectionExpression) và kiểm bằng zod;
 * - gọi lại phần DynamoDB chưa xử lý (UnprocessedKeys);
 * - không import code của catalog (ADR-0009). Catalog đổi tên hoặc kiểu các thuộc tính dưới đây
 *   thì phải sửa file này (ADR-0017, Hệ quả).
 */
const snapshotSchema = z.object({
  productId: z.string(),
  name: z.string(),
  price: z.number().int().nonnegative(),
  stock: z.number().int(),
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

export interface DynamoProductCatalogOptions {
  /** Số lần gọi lại phần UnprocessedKeys trước khi báo lỗi */
  readonly maxRetries?: number;
  /** Thời gian chờ trước lần gọi lại đầu tiên (ms), gấp đôi mỗi lần; test đặt 0 */
  readonly baseDelayMs?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class DynamoProductCatalog implements ProductCatalog {
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    options: DynamoProductCatalogOptions = {},
  ) {
    this.maxRetries = options.maxRetries ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 50;
  }

  async findMany(productIds: readonly string[]): Promise<Map<string, ProductSnapshot>> {
    const ids = [...new Set(productIds)];
    const found = new Map<string, ProductSnapshot>();
    // Một đơn tối đa 50 dòng (BR-02); BatchGetItem nhận tối đa 100 khoá
    for (let i = 0; i < ids.length; i += MAX_LINES) {
      for (const item of await this.batchGet(ids.slice(i, i + MAX_LINES))) {
        const parsed = snapshotSchema.safeParse(item);
        if (parsed.success) {
          found.set(parsed.data.productId, parsed.data);
        } else {
          // Sản phẩm hỏng dữ liệu coi như không còn bán: đơn báo OUT_OF_STOCK cho món đó
          logger.warn('Sản phẩm trong bảng products sai dữ liệu, coi như không còn bán', {
            productId: (item as { productId?: unknown }).productId,
            issues: parsed.error.issues.map((issue) => issue.path.join('.')),
          });
        }
      }
    }
    return found;
  }

  private async batchGet(productIds: readonly string[]): Promise<Record<string, unknown>[]> {
    const items: Record<string, unknown>[] = [];
    let keys: Record<string, unknown>[] = productIds.map((productId) => ({ productId }));
    for (let attempt = 0; keys.length > 0; attempt++) {
      if (attempt > this.maxRetries) {
        throw new Error(`BatchGetItem còn ${keys.length} khoá chưa đọc được sau ${attempt} lần`);
      }
      if (attempt > 0) await sleep(this.baseDelayMs * 2 ** (attempt - 1));
      const result = await this.db.send(
        new BatchGetCommand({
          RequestItems: {
            [this.tableName]: {
              Keys: keys,
              // name, status là từ khoá dành riêng của DynamoDB
              ProjectionExpression: 'productId, #name, price, stock, #status',
              ExpressionAttributeNames: { '#name': 'name', '#status': 'status' },
            },
          },
        }),
      );
      items.push(...(result.Responses?.[this.tableName] ?? []));
      keys = (result.UnprocessedKeys?.[this.tableName]?.Keys ?? []) as Record<string, unknown>[];
    }
    return items;
  }
}
