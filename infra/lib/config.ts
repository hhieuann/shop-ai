import type { App } from 'aws-cdk-lib';

export type EnvName = 'sbx' | 'dev' | 'staging' | 'prod';

export interface ShopEnvironment {
  readonly name: EnvName;
  /** Tiền tố tên stack và tài nguyên: shop-sbx-<tên>, shop-dev, shop-stg, shop-prd */
  readonly stackPrefix: string;
  readonly isProd: boolean;
}

const SHARED_ACCOUNT_PREFIX: Readonly<Record<Exclude<EnvName, 'sbx'>, string>> = {
  dev: 'shop-dev',
  staging: 'shop-stg',
  prod: 'shop-prd',
};

/** Đọc môi trường từ `-c env=...` (và `-c owner=...` với sandbox). Bắt buộc ghi rõ để không deploy nhầm chỗ. */
export function resolveEnvironment(app: App): ShopEnvironment {
  const name: unknown = app.node.tryGetContext('env');
  if (name === undefined) {
    throw new Error('Thiếu môi trường: thêm -c env=sbx|dev|staging|prod');
  }

  if (name === 'sbx') {
    const owner: unknown = app.node.tryGetContext('owner');
    if (typeof owner !== 'string' || !/^[a-z0-9]+$/.test(owner)) {
      throw new Error('Sandbox cần tên người dùng viết thường, vd. -c owner=an');
    }
    return { name, stackPrefix: `shop-sbx-${owner}`, isProd: false };
  }

  if (name === 'dev' || name === 'staging' || name === 'prod') {
    return { name, stackPrefix: SHARED_ACCOUNT_PREFIX[name], isProd: name === 'prod' };
  }

  throw new Error(`Môi trường không hợp lệ: ${String(name)}. Chỉ nhận sbx, dev, staging, prod`);
}
