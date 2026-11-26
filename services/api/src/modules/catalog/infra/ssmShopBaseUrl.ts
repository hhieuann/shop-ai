import { GetParameterCommand, type SSMClient } from '@aws-sdk/client-ssm';
import { isShopBaseUrl } from '../domain/productImage.js';
import type { ShopBaseUrlSource } from '../ports.js';

/**
 * Tên miền shop (`https://<cloudfront>`) đọc từ tham số SSM do stack web ghi (hạ tầng #561), vd.
 * `/shop/<env>/web/base-url`. Stack API không nhận thẳng tên miền vì stack web phụ thuộc stack API
 * (vòng phụ thuộc). Đọc ở lần xin vé đầu rồi giữ trong bộ nhớ Lambda như khoá HMAC
 * (shared/userIdHash.ts); đọc lỗi hoặc giá trị không phải https thì lần sau đọc lại, không giữ lỗi.
 */
export class SsmShopBaseUrl implements ShopBaseUrlSource {
  private value: Promise<string> | undefined;

  constructor(
    private readonly ssm: SSMClient,
    private readonly parameterName: string,
  ) {}

  get(): Promise<string> {
    this.value ??= this.load().catch((error: unknown) => {
      this.value = undefined;
      throw error;
    });
    return this.value;
  }

  private async load(): Promise<string> {
    const { Parameter } = await this.ssm.send(
      new GetParameterCommand({ Name: this.parameterName }),
    );
    const value = Parameter?.Value?.trim() ?? '';
    // Lỗi không phải AppError: handler log và trả 500, không lộ chi tiết cho client
    if (!isShopBaseUrl(value)) {
      throw new Error(`Tham số ${this.parameterName} không phải tên miền https`);
    }
    return value;
  }
}
