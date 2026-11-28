import { GetParameterCommand, type SSMClient } from '@aws-sdk/client-ssm';
import { describe, expect, it, vi } from 'vitest';
import { SsmShopBaseUrl } from './ssmShopBaseUrl.js';

const PARAM = '/shop-dev/web/base-url';
const BASE = 'https://d111111abcdef8.cloudfront.net';

function ssmReturning(...results: Array<string | undefined | Error>) {
  const send = vi.fn();
  for (const r of results) {
    if (r instanceof Error) send.mockRejectedValueOnce(r);
    else send.mockResolvedValueOnce({ Parameter: r === undefined ? undefined : { Value: r } });
  }
  return { ssm: { send } as unknown as SSMClient, send };
}

describe('SsmShopBaseUrl', () => {
  it('get_readsParameterOnce_thenCaches', async () => {
    // Arrange
    const { ssm, send } = ssmReturning(BASE);
    const source = new SsmShopBaseUrl(ssm, PARAM);

    // Act
    const a = await source.get();
    const b = await source.get();

    // Assert
    expect(a).toBe(BASE);
    expect(b).toBe(BASE);
    // Verify: chỉ đọc SSM một lần, đúng tên tham số
    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0]?.[0] as GetParameterCommand;
    expect(command).toBeInstanceOf(GetParameterCommand);
    expect(command.input).toEqual({ Name: PARAM });
  });

  it('get_trimsWhitespace', async () => {
    const { ssm } = ssmReturning(`  ${BASE}/\n`);
    await expect(new SsmShopBaseUrl(ssm, PARAM).get()).resolves.toBe(`${BASE}/`);
  });

  it.each<[string, string | undefined]>([
    ['không có tham số', undefined],
    ['rỗng', ''],
    ['http', 'http://d111111abcdef8.cloudfront.net'],
    ['thiếu https', 'd111111abcdef8.cloudfront.net'],
    ['có đường dẫn', `${BASE}/images`],
  ])('get_rejects_when_%s', async (_name, value) => {
    // Arrange
    const { ssm } = ssmReturning(value);

    // Act + Assert
    await expect(new SsmShopBaseUrl(ssm, PARAM).get()).rejects.toThrow(PARAM);
  });

  it('get_doesNotCacheFailure_readsAgainNextTime', async () => {
    // Arrange: lần đầu SSM lỗi, lần sau đọc được
    const { ssm, send } = ssmReturning(new Error('ThrottlingException'), BASE);
    const source = new SsmShopBaseUrl(ssm, PARAM);

    // Act + Assert
    await expect(source.get()).rejects.toThrow('ThrottlingException');
    await expect(source.get()).resolves.toBe(BASE);
    // Verify
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('get_doesNotCacheInvalidValue', async () => {
    // Arrange: lần đầu giá trị sai, sau khi sửa tham số thì đọc lại được
    const { ssm, send } = ssmReturning('http://sai', BASE);
    const source = new SsmShopBaseUrl(ssm, PARAM);

    // Act + Assert
    await expect(source.get()).rejects.toThrow();
    await expect(source.get()).resolves.toBe(BASE);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('get_concurrentCallsShareOneRead', async () => {
    // Arrange
    const { ssm, send } = ssmReturning(BASE);
    const source = new SsmShopBaseUrl(ssm, PARAM);

    // Act
    const values = await Promise.all([source.get(), source.get(), source.get()]);

    // Assert
    expect(values).toEqual([BASE, BASE, BASE]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
