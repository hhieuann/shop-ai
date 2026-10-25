import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { HmacUserIdHasher, ssmKeyLoader } from '../../shared/userIdHash.js';
import { recordPurchase, type RecordPurchaseDeps } from './application/recordPurchase.js';
import { DynamoEventRepository } from './infra/dynamoEventRepository.js';
import { makePurchaseHandler } from './purchaseHandler.js';

// Lambda riêng cho tin order-confirmed (SQS), tách khỏi Lambda API để mỗi cái chỉ có quyền nó cần.
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const ssm = captureClient(new SSMClient({}));

const deps: RecordPurchaseDeps = {
  events: new DynamoEventRepository(db, requiredEnv('EVENTS_TABLE')),
  // Cùng khoá HMAC với Lambda API, nên PURCHASE và VIEW của một người có cùng userIdHash
  hasher: new HmacUserIdHasher(ssmKeyLoader(ssm, requiredEnv('HMAC_KEY_PARAMETER'))),
};

export const handler = withTracing(
  makePurchaseHandler({ recordPurchase: (message) => recordPurchase(deps, message) }),
);
