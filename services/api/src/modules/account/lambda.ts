import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { requiredEnv } from '../../shared/config.js';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { changeUsername } from './application/changeUsername.js';
import { makeHandler } from './handler.js';
import { CognitoUserDirectory } from './infra/cognitoUserDirectory.js';

// File nạp của Lambda account (GET, PATCH /api/v1/me). Client tạo một lần ngoài handler để dùng lại.
// Lambda này không phải trigger nên đọc được USER_POOL_ID từ biến môi trường mà không tạo vòng.
const users = new CognitoUserDirectory(
  captureClient(new CognitoIdentityProviderClient({})),
  requiredEnv('USER_POOL_ID'),
);

export const handler = withTracing(
  makeHandler({ changeUsername: (input) => changeUsername({ users }, input) }),
);
