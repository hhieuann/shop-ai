import { App, Tags, Validations } from 'aws-cdk-lib';
import { AwsSolutionsChecks } from 'cdk-nag';
import { ApiStack } from '../lib/api-stack.js';
import { resolveEnvironment } from '../lib/config.js';

const app = new App();
const shopEnv = resolveEnvironment(app);

Tags.of(app).add('project', 'shop-ai');
Tags.of(app).add('env', shopEnv.name);

new ApiStack(app, `${shopEnv.stackPrefix}-api`, {
  shopEnv,
  // Tài khoản lấy từ phiên đăng nhập hiện tại: aws login ở máy, OIDC trong CI
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-southeast-1' },
  terminationProtection: shopEnv.isProd,
  description: `shop-ai API (${shopEnv.name})`,
});

// Kiểm bảo mật theo bộ luật AWS Solutions mỗi lần synth; còn lỗi chưa xử lý thì synth thất bại.
Validations.of(app).addPlugins(new AwsSolutionsChecks(app, { verbose: true }));
