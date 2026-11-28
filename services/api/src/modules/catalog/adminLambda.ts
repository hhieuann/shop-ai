import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { requiredEnv } from '../../shared/config.js';
import { logger } from '../../shared/logger.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { makeAdminProductHandler } from './adminHandler.js';
import { createAdminProduct } from './application/createAdminProduct.js';
import { createProductImageUpload } from './application/createProductImageUpload.js';
import { deleteAdminProduct } from './application/deleteAdminProduct.js';
import { getAdminProduct } from './application/getAdminProduct.js';
import { listAdminProducts } from './application/listAdminProducts.js';
import { restoreAdminProduct } from './application/restoreAdminProduct.js';
import { updateAdminProduct } from './application/updateAdminProduct.js';
import { DynamoAdminProductReader } from './infra/dynamoAdminProductReader.js';
import { DynamoAdminProductWriter } from './infra/dynamoAdminProductWriter.js';
import { DynamoProductRepository } from './infra/dynamoProductRepository.js';
import { S3ProductImageSigner } from './infra/s3ProductImageSigner.js';
import { SsmShopBaseUrl } from './infra/ssmShopBaseUrl.js';
import { productImagesConfig } from './productImagesConfig.js';

// Lambda riêng của API admin sản phẩm (catalog.md BR-09 … BR-15), tách khỏi Lambda catalog công khai
// (chỉ đọc món ACTIVE). Hạ tầng (#546) trỏ Lambda CatalogAdminFunction vào file này. Không cache
// danh sách trong bộ nhớ như API khách: admin cần thấy ngay món vừa sửa.
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const table = requiredEnv('PRODUCTS_TABLE');
const products = new DynamoProductRepository(db, table);
const reader = new DynamoAdminProductReader(db, table);
const writer = new DynamoAdminProductWriter(db, table);
const now = () => new Date().toISOString();

// Tải ảnh (BR-16, #560): bucket và tên tham số SSM chứa tên miền shop do hạ tầng (#561) thêm. Thiếu thì
// tắt tải ảnh, log một lần lúc khởi động; route tải ảnh trả 500, các route khác vẫn chạy
const images = productImagesConfig(process.env);
if (!images.enabled) {
  logger.warn('Chưa đủ cấu hình tải ảnh sản phẩm, POST /admin/product-images tắt', {
    missing: images.missing,
  });
}

export const handler = withTracing(
  makeAdminProductHandler({
    listAdminProducts: (input) => listAdminProducts({ reader }, input),
    getAdminProduct: (input) => getAdminProduct({ products }, input),
    // Không bọc idempotency: bấm lưu hai lần có thể tạo hai món, web khoá nút (catalog.md giới hạn)
    createAdminProduct: (input) => createAdminProduct({ writer, newId: ulid, now }, input),
    updateAdminProduct: (input) => updateAdminProduct({ products, writer, now }, input),
    deleteAdminProduct: (input) => deleteAdminProduct({ products, writer, now }, input),
    restoreAdminProduct: (input) => restoreAdminProduct({ products, writer, now }, input),
    createProductImageUpload: images.enabled
      ? (() => {
          const signer = new S3ProductImageSigner(
            captureClient(new S3Client({})),
            images.config.bucket,
          );
          // Tên miền shop đọc từ SSM ở lần xin vé đầu, giữ trong bộ nhớ Lambda (như khoá HMAC)
          const baseUrl = new SsmShopBaseUrl(
            captureClient(new SSMClient({})),
            images.config.baseUrlParameter,
          );
          return (input) =>
            createProductImageUpload(
              { signer, newId: ulid, baseUrl, now: () => new Date() },
              input,
            );
        })()
      : async () => {
          // Lỗi không phải AppError: handler log và trả 500, không lộ chi tiết
          throw new Error(`Tải ảnh chưa bật: thiếu ${images.missing.join(', ')}`);
        },
  }),
);
