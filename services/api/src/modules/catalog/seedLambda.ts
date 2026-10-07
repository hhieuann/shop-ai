/**
 * Lambda nạp sản phẩm demo khi deploy (custom resource của CloudFormation, infra/lib/api-stack.ts).
 * Chỉ có ở sandbox, dev, staging; stack prod không tạo Lambda này, và writeProducts còn tự chặn
 * bảng prod lần nữa.
 *
 * Create, Update: đọc products.json (đóng gói cạnh file này lúc bundle) rồi ghi đè theo productId,
 * nên chạy lại không nhân đôi. Update chạy khi nội dung products.json đổi (stack truyền mã băm).
 * Delete: không làm gì; bảng bị xoá cùng stack ở môi trường không phải prod.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { CloudFormationCustomResourceEvent } from 'aws-lambda';
import { requiredEnv } from '../../shared/config.js';
import { parseSeedFile, writeProducts } from './infra/productSeed.js';

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
  const written = await writeProducts(db, requiredEnv('PRODUCTS_TABLE'), products);
  return { PhysicalResourceId: physicalId, Data: { written } };
}
