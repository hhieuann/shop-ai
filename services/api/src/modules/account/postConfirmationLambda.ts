import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import { captureClient, withTracing } from '../../shared/tracer.js';
import { CognitoSessionRevoker } from './infra/cognitoSessionRevoker.js';
import { makePostConfirmationHandler } from './postConfirmation.js';

// File nạp của Lambda Post confirmation. Client tạo một lần ngoài handler để dùng lại.
// userPoolId lấy từ event: đặt vào biến môi trường sẽ tạo phụ thuộc vòng giữa user pool và Lambda.
const cognito = captureClient(new CognitoIdentityProviderClient({}));
const handle = makePostConfirmationHandler({ sessions: new CognitoSessionRevoker(cognito) });

export const handler = withTracing((event: PostConfirmationTriggerEvent) => handle(event));
