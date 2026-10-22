import type { CreateTableCommandInput } from '@aws-sdk/client-dynamodb';

/** Bảng events như trong docs/business/dynamodb-design.md: khoá `userIdHash` + `eventKey`. */
export function eventsTableDefinition(tableName: string): CreateTableCommandInput {
  return {
    TableName: tableName,
    AttributeDefinitions: [
      { AttributeName: 'userIdHash', AttributeType: 'S' },
      { AttributeName: 'eventKey', AttributeType: 'S' },
    ],
    KeySchema: [
      { AttributeName: 'userIdHash', KeyType: 'HASH' },
      { AttributeName: 'eventKey', KeyType: 'RANGE' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  };
}
