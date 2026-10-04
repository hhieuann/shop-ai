import { App } from 'aws-cdk-lib';
import { describe, expect, it } from 'vitest';
import { resolveEnvironment } from '../lib/config.js';

describe('resolveEnvironment', () => {
  it.each([
    { env: 'dev', stackPrefix: 'shop-dev', isProd: false },
    { env: 'staging', stackPrefix: 'shop-stg', isProd: false },
    { env: 'prod', stackPrefix: 'shop-prd', isProd: true },
  ])('resolveEnvironment_returns$stackPrefix_whenEnvIs$env', ({ env, stackPrefix, isProd }) => {
    // Arrange
    const app = new App({ context: { env } });

    // Act
    const result = resolveEnvironment(app);

    // Assert
    expect(result).toEqual({ name: env, stackPrefix, isProd });
  });

  it('resolveEnvironment_putsOwnerInStackPrefix_whenEnvIsSandbox', () => {
    // Arrange
    const app = new App({ context: { env: 'sbx', owner: 'an' } });

    // Act
    const result = resolveEnvironment(app);

    // Assert
    expect(result).toEqual({ name: 'sbx', stackPrefix: 'shop-sbx-an', isProd: false });
  });

  it('resolveEnvironment_throwsAskingForOwner_whenSandboxHasNoOwner', () => {
    // Arrange
    const app = new App({ context: { env: 'sbx' } });

    // Act
    const act = () => resolveEnvironment(app);

    // Assert
    expect(act).toThrow('-c owner=');
  });

  it('resolveEnvironment_throwsAskingForEnv_whenEnvIsMissing', () => {
    // Arrange
    const app = new App();

    // Act
    const act = () => resolveEnvironment(app);

    // Assert
    expect(act).toThrow('-c env=');
  });

  it('resolveEnvironment_throwsNamingTheValue_whenEnvIsUnknown', () => {
    // Arrange
    const app = new App({ context: { env: 'production' } });

    // Act
    const act = () => resolveEnvironment(app);

    // Assert
    expect(act).toThrow('production');
  });
});
