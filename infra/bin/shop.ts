import { existsSync } from 'node:fs';
import path from 'node:path';
import { App, Tags, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { ApiStack } from '../lib/api-stack.js';
import { resolveEnvironment } from '../lib/config.js';
import { WebStack } from '../lib/web-stack.js';

const app = new App();
const shopEnv = resolveEnvironment(app);

Tags.of(app).add('project', 'shop-ai');
Tags.of(app).add('env', shopEnv.name);

// Tài khoản lấy từ phiên đăng nhập hiện tại: aws login ở máy, OIDC trong CI
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-southeast-1' };

const api = new ApiStack(app, `${shopEnv.stackPrefix}-api`, {
  shopEnv,
  env,
  terminationProtection: shopEnv.isProd,
  description: `shop-ai API (${shopEnv.name})`,
});

// Stack web đóng gói bản build có sẵn; thiếu thì dừng ngay thay vì deploy web rỗng
const webDistPath = path.join(import.meta.dirname, '..', '..', 'apps', 'web', 'dist');
if (!existsSync(path.join(webDistPath, 'index.html'))) {
  throw new Error(
    'Chưa có bản build web. Chạy `pnpm --filter web build` trước khi synth hoặc deploy.',
  );
}

new WebStack(app, `${shopEnv.stackPrefix}-web`, {
  shopEnv,
  env,
  httpApi: api.httpApi,
  webDistPath,
  terminationProtection: shopEnv.isProd,
  description: `shop-ai web (${shopEnv.name})`,
});

// Kiểm bảo mật theo bộ luật AWS Solutions mỗi lần synth; còn lỗi chưa xử lý thì synth thất bại.
Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
