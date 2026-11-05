import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { HmacUserIdHasher, ssmKeyLoader } from '../../shared/userIdHash.js';
import { recordEvent, type RecordEventDeps } from './application/recordEvent.js';
import { makeHandler } from './handler.js';
import { DynamoEventRepository } from './infra/dynamoEventRepository.js';

// Chỗ duy nhất ghép use case với adapter thật; CDK trỏ Lambda vào file này.
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const ssm = captureClient(new SSMClient({}));
// Tên tham số, không phải khoá: /shop/<env>/events/hmac-key, SecureString An tạo bằng CLI
const hmacKeyParameter = requiredEnv('HMAC_KEY_PARAMETER');

const deps: RecordEventDeps = {
  events: new DynamoEventRepository(db, requiredEnv('EVENTS_TABLE')),
  hasher: new HmacUserIdHasher(ssmKeyLoader(ssm, hmacKeyParameter)),
  now: () => new Date().toISOString(),
  // ULID theo chuẩn code (CONTRIBUTING.md): duy nhất và tăng dần theo thời gian
  newId: () => ulid(),
};

export const handler = withTracing(
  makeHandler({ recordEvent: (input) => recordEvent(deps, input) }),
);
