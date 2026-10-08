import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import type { PreSignUpTriggerEvent } from 'aws-lambda';
import { CognitoUserDirectory } from './infra/cognitoUserDirectory.js';
import { makePreSignUpHandler } from './preSignUp.js';

// File nạp của Lambda Pre sign-up. Client tạo một lần ngoài handler để dùng lại.
// userPoolId lấy từ event: đặt vào biến môi trường sẽ tạo phụ thuộc vòng giữa user pool và Lambda.
const cognito = new CognitoIdentityProviderClient({});

export const handler = (event: PreSignUpTriggerEvent) =>
  makePreSignUpHandler({ users: new CognitoUserDirectory(cognito, event.userPoolId) })(event);
