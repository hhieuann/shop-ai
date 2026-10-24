import { GetCommand, QueryCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { z } from 'zod';
import { logger } from '../../../shared/logger.js';
import type { RecsPointer, RecType } from '../domain/recs.js';
import type { RecsStore } from '../ports.js';

/**
 * Đọc bảng `recs` mà pipeline mỗi đêm của Nhân ghi (dynamodb-design.md, bảng recs), CHỈ ĐỌC:
 * - con trỏ `pk = META, sk = ACTIVE#<recType>`: GetItem, giữ trong Lambda 60 giây vì mỗi đêm mới đổi;
 * - dòng gợi ý `pk = <recType>#<anchor>, sk = <version>#<rank>`: Query theo tiền tố phiên bản,
 *   `rank` đệm 2 chữ số nên sắp theo `sk` là đúng thứ hạng.
 * Quyền IAM chỉ GetItem, Query trên bảng recs (infra/lib/api-stack.ts).
 */
const pointerSchema = z.object({
  activeVersion: z.number().int().positive(),
  basis: z.enum(['PURCHASES_30D', 'PURCHASES_90D', 'PURCHASES_365D', 'NEWEST']).optional(),
});

/** Mã sản phẩm ở cột `productId` (nhóm chốt với Nhân 22/10, dynamodb-design.md bảng recs) */
const rowSchema = z.object({ productId: z.string() });

/** Đủ cho pipeline ghi tối đa 20 dòng mỗi anchor; Query dừng sớm nếu ghi ít hơn */
const MAX_ROWS = 20;

export interface DynamoRecsStoreOptions {
  /** Thời gian giữ con trỏ trong bộ nhớ (ms) */
  readonly pointerTtlMs?: number;
  /** Đồng hồ, test truyền bản giả */
  readonly now?: () => number;
}

export class DynamoRecsStore implements RecsStore {
  private readonly pointerTtlMs: number;
  private readonly now: () => number;
  private readonly pointers = new Map<
    RecType,
    { readonly value: Promise<RecsPointer | null>; readonly expiresAt: number }
  >();

  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
    options: DynamoRecsStoreOptions = {},
  ) {
    this.pointerTtlMs = options.pointerTtlMs ?? 60_000;
    this.now = options.now ?? Date.now;
  }

  activePointer(recType: RecType): Promise<RecsPointer | null> {
    const cached = this.pointers.get(recType);
    if (cached && cached.expiresAt > this.now()) return cached.value;

    // Giữ cả Promise để các request cùng lúc chỉ đọc một lần; đọc lỗi thì bỏ cache, lần sau đọc lại
    const value = this.readPointer(recType).catch((error: unknown) => {
      this.pointers.delete(recType);
      throw error;
    });
    this.pointers.set(recType, { value, expiresAt: this.now() + this.pointerTtlMs });
    return value;
  }

  async rankedProductIds(recType: RecType, anchor: string, version: number): Promise<string[]> {
    const { Items = [] } = await this.db.send(
      new QueryCommand({
        TableName: this.tableName,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :version)',
        ExpressionAttributeValues: { ':pk': `${recType}#${anchor}`, ':version': `${version}#` },
        ProjectionExpression: 'productId',
        Limit: MAX_ROWS,
      }),
    );
    return Items.flatMap((item) => {
      const parsed = rowSchema.safeParse(item);
      return parsed.success ? [parsed.data.productId] : [];
    });
  }

  private async readPointer(recType: RecType): Promise<RecsPointer | null> {
    const { Item } = await this.db.send(
      new GetCommand({ TableName: this.tableName, Key: { pk: 'META', sk: `ACTIVE#${recType}` } }),
    );
    if (!Item) return null;
    const parsed = pointerSchema.safeParse(Item);
    if (!parsed.success) {
      // Con trỏ hỏng thì coi như pipeline chưa chạy: web ẩn widget, không trả 500
      logger.warn('Con trỏ bảng recs sai dữ liệu, coi như chưa có gợi ý', {
        recType,
        issues: parsed.error.issues.map((issue) => issue.path.join('.')),
      });
      return null;
    }
    const { activeVersion, basis } = parsed.data;
    return basis === undefined ? { version: activeVersion } : { version: activeVersion, basis };
  }
}
