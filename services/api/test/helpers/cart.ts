import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/** Bảng carts như trong infra/lib/api-stack.ts: khoá `userId`, on-demand. */
export function cartsTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    BillingMode: 'PAY_PER_REQUEST',
  };
}
