import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { PutCommand, type DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { StoredEvent } from '../domain/event.js';
import type { EventRepository } from '../ports.js';

/**
 * Bảng events theo docs/business/dynamodb-design.md: khoá `userIdHash`, sort key
 * `eventKey` = `<timestamp>#<eventId>` để sự kiện của một người nằm theo thứ tự thời gian.
 */
export function eventKey(event: Pick<StoredEvent, 'timestamp' | 'eventId'>): string {
  return `${event.timestamp}#${event.eventId}`;
}

export class DynamoEventRepository implements EventRepository {
  constructor(
    private readonly db: DynamoDBDocumentClient,
    private readonly tableName: string,
  ) {}

  async put(event: StoredEvent): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.tableName,
        Item: { ...event, eventKey: eventKey(event) },
        // eventId ngẫu nhiên nên gần như không trùng; điều kiện này để không bao giờ ghi đè
        ConditionExpression: 'attribute_not_exists(eventKey)',
      }),
    );
  }

  async putOnce(event: StoredEvent): Promise<boolean> {
    try {
      await this.put(event);
      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException) return false;
      throw error;
    }
  }
}
