/**
 * Nạp sản phẩm demo vào bảng products.
 *
 *   pnpm --filter api seed:products -- --dry-run
 *   pnpm --filter api seed:products -- --table <ProductsTableName>
 *
 * Mặc định đọc seed/catalog/products.json, region ap-southeast-1. Dùng phiên đăng nhập AWS hiện tại
 * (aws login). Không bao giờ chạy vào prod.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import {
  assertNotProductionTable,
  parseSeedFile,
  writeProducts,
} from '../src/modules/catalog/infra/productSeed.js';

const out = (line: string) => process.stdout.write(`${line}\n`);

const { values } = parseArgs({
  // pnpm chuyển cả dấu "--" vào script ("pnpm … seed:products -- --dry-run"); bỏ nó để parseArgs đọc đúng
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: {
    file: {
      type: 'string',
      default: path.join(import.meta.dirname, '..', 'seed', 'catalog', 'products.json'),
    },
    table: { type: 'string' },
    region: { type: 'string', default: 'ap-southeast-1' },
    'dry-run': { type: 'boolean', default: false },
  },
});

async function main(): Promise<void> {
  const products = parseSeedFile(JSON.parse(await readFile(values.file, 'utf8')));

  const byCategory = new Map<string, number>();
  for (const p of products) byCategory.set(p.category, (byCategory.get(p.category) ?? 0) + 1);
  out(`File ${values.file}: ${products.length} sản phẩm hợp lệ`);
  for (const [category, count] of [...byCategory].sort()) out(`  ${category.padEnd(10)} ${count}`);
  out(
    `  hết hàng ${products.filter((p) => p.stock === 0).length}, ngừng bán ${products.filter((p) => p.status === 'INACTIVE').length}`,
  );

  if (values['dry-run']) {
    out('--dry-run: không ghi gì.');
  } else {
    if (!values.table)
      throw new Error('Thiếu --table <tên bảng products>, xem output ProductsTableName của stack');
    assertNotProductionTable(values.table);
    const db = DynamoDBDocumentClient.from(new DynamoDBClient({ region: values.region }));
    const written = await writeProducts(db, values.table, products);
    out(`Đã ghi ${written} sản phẩm vào ${values.table} (${values.region}).`);
  }
}

// Lỗi đã biết (file sai, thiếu --table, bảng prod) chỉ in thông báo, không in stack trace dài
main().catch((error: unknown) => {
  process.stderr.write(`Lỗi: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
