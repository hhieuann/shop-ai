/**
 * Lambda nạp sản phẩm demo khi deploy (custom resource của CloudFormation, infra/lib/api-stack.ts).
 *
 * Create, Update: đọc products.json (đóng gói cạnh file này lúc bundle). Update chạy khi nội dung
 * products.json đổi (stack truyền mã băm). SEED_MODE do CDK đặt:
 * - overwrite (sandbox, dev, staging): ghi đè theo productId, chạy lại không nhân đôi;
 *   writeProducts còn tự chặn bảng prod.
 * - insert-missing (prod): chỉ thêm sản phẩm chưa có, giữ tồn kho và giá đang chạy.
 * Delete: không làm gì; bảng bị xoá cùng stack ở môi trường không phải prod, prod giữ lại bảng.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { requiredEnv } from '../../shared/config.js';
import { insertMissingProducts, parseSeedFile, writeProducts } from './infra/productSeed.js';

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

export const SEED_FILE_NAME = 'products.json';

export async function handler(
  event: CloudFormationCustomResourceEvent,
): Promise<{ PhysicalResourceId: string; Data: { written: number } }> {
  const physicalId = 'catalog-demo-products';
  if (event.RequestType === 'Delete')
    return { PhysicalResourceId: physicalId, Data: { written: 0 } };

  const file = path.join(import.meta.dirname, SEED_FILE_NAME);
  const products = parseSeedFile(JSON.parse(await readFile(file, 'utf8')));
  const table = requiredEnv('PRODUCTS_TABLE');
  const mode = requiredEnv('SEED_MODE');
  if (mode === 'insert-missing') {
    const { inserted } = await insertMissingProducts(db, table, products);
    return { PhysicalResourceId: physicalId, Data: { written: inserted } };
  }
  if (mode !== 'overwrite') throw new Error(`SEED_MODE không hợp lệ: ${mode}`);
  const written = await writeProducts(db, table, products);
  return { PhysicalResourceId: physicalId, Data: { written } };
}
