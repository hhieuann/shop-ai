import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import type { ShopEnvironment } from '../lib/config.js';
import { RecsTable } from '../lib/recs-table.js';

const dev: ShopEnvironment = { name: 'dev', stackPrefix: 'shop-dev', isProd: false };
const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };

/** Dựng RecsTable trong một stack trống: test chỉ phần bảng, không cần cả ApiStack. */
function synth(shopEnv: ShopEnvironment): Template {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { region: 'ap-southeast-1' } });
  new RecsTable(stack, 'Recs', { shopEnv });
  return Template.fromStack(stack);
}

describe('RecsTable', () => {
  it('table_usesPkSkStringKeysOnDemand', () => {
    // Act
    const template = synth(dev);

    // Assert: khoá đúng dynamodb-design.md để pipeline và API đọc ghi cùng định dạng
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      KeySchema: [
        { AttributeName: 'pk', KeyType: 'HASH' },
        { AttributeName: 'sk', KeyType: 'RANGE' },
      ],
      AttributeDefinitions: [
        { AttributeName: 'pk', AttributeType: 'S' },
        { AttributeName: 'sk', AttributeType: 'S' },
      ],
      BillingMode: 'PAY_PER_REQUEST',
    });
  });

  it('table_expiresRowsByTtlColumn', () => {
    // Act
    const template = synth(dev);

    // Assert: phiên bản cũ tự xoá sau 7 ngày, con trỏ không có cột ttl nên giữ mãi
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      TimeToLiveSpecification: { AttributeName: 'ttl', Enabled: true },
    });
  });

  it('table_isRetainedWithStack_whenProd', () => {
    // Act
    const template = synth(prod);

    // Assert
    template.hasResource('AWS::DynamoDB::Table', { DeletionPolicy: 'Retain' });
  });

  it('table_isDeletedWithStack_whenNotProd', () => {
    // Act
    const template = synth(dev);

    // Assert
    template.hasResource('AWS::DynamoDB::Table', { DeletionPolicy: 'Delete' });
  });

  it('table_isTaggedWithRecommendationModule', () => {
    // Act
    const template = synth(dev);

    // Assert: chi phí lọc được theo module trong Cost Explorer
    template.hasResourceProperties('AWS::DynamoDB::Table', {
      Tags: Match.arrayWith([{ Key: 'module', Value: 'recommendation' }]),
    });
  });
});
