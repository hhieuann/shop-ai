import { describe, expect, it } from 'vitest';
import { adminCancelConfig } from './adminCancelConfig.js';

describe('adminCancelConfig', () => {
  it('adminCancelConfig_enabled_whenBothVarsSet', () => {
    // Act
    const result = adminCancelConfig({
      PRODUCTS_TABLE: 'shop-dev-api-ProductsTable',
      ORDERS_QUEUE_URL: 'https://sqs.example/orders',
    });

    // Assert
    expect(result).toEqual({
      enabled: true,
      config: {
        productsTable: 'shop-dev-api-ProductsTable',
        ordersQueueUrl: 'https://sqs.example/orders',
      },
    });
  });

  it.each([
    [{}, ['PRODUCTS_TABLE', 'ORDERS_QUEUE_URL']],
    [{ PRODUCTS_TABLE: 'p' }, ['ORDERS_QUEUE_URL']],
    [{ ORDERS_QUEUE_URL: 'q', PRODUCTS_TABLE: '' }, ['PRODUCTS_TABLE']],
  ])('adminCancelConfig_disabledWithMissingNames_when %j', (env, missing) => {
    // Act + Assert: chưa có hạ tầng #449 thì tắt huỷ đơn, không ném lỗi lúc khởi động
    expect(adminCancelConfig(env)).toEqual({ enabled: false, missing });
  });
});
