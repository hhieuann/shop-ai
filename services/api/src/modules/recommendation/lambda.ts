import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { SSMClient } from '@aws-sdk/client-ssm';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { HmacUserIdHasher, ssmKeyLoader } from '../../shared/userIdHash.js';
import { getAlsoBought, getBestsellers, getForYou, type RecsDeps } from './application/getRecs.js';
import { makeHandler } from './handler.js';
import { DynamoProductCatalog } from './infra/dynamoProductCatalog.js';
import { DynamoRecsStore } from './infra/dynamoRecsStore.js';

// Chỗ duy nhất ghép use case với adapter thật; CDK trỏ Lambda vào file này.
// Client và cache con trỏ 60 giây tạo ngoài handler để các request trên cùng một Lambda dùng chung.
const db = DynamoDBDocumentClient.from(captureClient(new DynamoDBClient({})));
const ssm = captureClient(new SSMClient({}));

const deps: RecsDeps = {
  recs: new DynamoRecsStore(db, requiredEnv('RECS_TABLE')),
  // Bảng của catalog, chỉ đọc (ADR-0017)
  catalog: new DynamoProductCatalog(db, requiredEnv('PRODUCTS_TABLE')),
  // Cùng khoá HMAC với events để ra cùng userIdHash; khoá chỉ đọc khi có request for-you đầu tiên
  hasher: new HmacUserIdHasher(ssmKeyLoader(ssm, requiredEnv('HMAC_KEY_PARAMETER'))),
};

export const handler = withTracing(
  makeHandler({
    getAlsoBought: (input) => getAlsoBought(deps, input),
    getForYou: (input) => getForYou(deps, input),
    getBestsellers: (input) => getBestsellers(deps, input),
  }),
);
