import { describe, expect, it } from 'vitest';
import { emailConfig } from './emailConfig.js';

const FULL = {
  USER_POOL_ID: 'ap-southeast-1_test',
  ORDER_IDEMPOTENCY_TABLE: 'order-idempotency-test',
  SENDER_EMAIL: 'shop@example.com',
};

describe('emailConfig', () => {
  it('emailConfig_isEnabled_whenAllThreeVariablesPresent', () => {
    // Act
    const result = emailConfig(FULL);

    // Assert
    expect(result).toEqual({
      enabled: true,
      config: {
        userPoolId: 'ap-southeast-1_test',
        idempotencyTable: 'order-idempotency-test',
        senderEmail: 'shop@example.com',
      },
    });
  });

  it.each(['USER_POOL_ID', 'ORDER_IDEMPOTENCY_TABLE', 'SENDER_EMAIL'] as const)(
    'emailConfig_isDisabled_andNamesMissing_when%sMissing',
    (name) => {
      // Arrange: vd. Lambda worker của #263 trước khi PR quyền SES, Cognito thêm biến
      const env: Record<string, string | undefined> = { ...FULL, [name]: undefined };

      // Act
      const result = emailConfig(env);

      // Assert: chỉ tên biến, không giá trị
      expect(result).toEqual({ enabled: false, missing: [name] });
    },
  );

  it('emailConfig_treatsEmptyStringAsMissing', () => {
    // Act: CI của PR truyền -c senderEmail="" khi không có secret
    const result = emailConfig({ ...FULL, SENDER_EMAIL: '' });

    // Assert
    expect(result).toEqual({ enabled: false, missing: ['SENDER_EMAIL'] });
  });

  it('emailConfig_listsAllMissing_whenNoneSet', () => {
    // Act: Lambda worker hiện tại chỉ có ORDERS_TABLE, ORDER_CONFIRMED_TOPIC_ARN
    const result = emailConfig({ ORDERS_TABLE: 'orders' });

    // Assert
    expect(result).toEqual({
      enabled: false,
      missing: ['USER_POOL_ID', 'ORDER_IDEMPOTENCY_TABLE', 'SENDER_EMAIL'],
    });
  });
});
