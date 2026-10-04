import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { GenericContainer } from 'testcontainers';

/** Cùng phiên bản với docker-compose.yml. */
export const DYNAMODB_LOCAL_IMAGE = 'amazon/dynamodb-local:3.3.1';

export interface DynamoLocal {
  readonly client: DynamoDBClient;
  readonly doc: DynamoDBDocumentClient;
  stop(): Promise<void>;
}

/** Bật một DynamoDB Local mới cho mỗi file test; tự dọn khi gọi stop(). */
export async function startDynamoLocal(): Promise<DynamoLocal> {
  const container = await new GenericContainer(DYNAMODB_LOCAL_IMAGE).withExposedPorts(8000).start();
  const client = new DynamoDBClient({
    endpoint: `http://${container.getHost()}:${container.getMappedPort(8000)}`,
    region: 'ap-southeast-1',
    credentials: { accessKeyId: 'local', secretAccessKey: 'local' }, // DynamoDB Local không kiểm tra
  });

  return {
    client,
    doc: DynamoDBDocumentClient.from(client),
    async stop() {
      client.destroy();
      await container.stop();
    },
  };
}
