import { SendEmailCommand, type SESv2Client } from '@aws-sdk/client-sesv2';
import { describe, expect, it, vi } from 'vitest';
import { sesClientConfig, SesMailer } from './sesMailer.js';

const CONTENT = {
  subject: 'Black Magic: đã xác nhận đơn 01K8',
  text: 'Xin chào',
  html: '<p>Xin chào</p>',
};

function sesError(name: string): Error {
  const error = new Error(name);
  error.name = name;
  return error;
}

function mailer(send = vi.fn().mockResolvedValue({})) {
  return { send, mailer: new SesMailer({ send } as unknown as SESv2Client, 'shop@example.com') };
}

describe('SesMailer', () => {
  it('send_sendsUtf8TextAndHtml_fromShopName', async () => {
    // Arrange
    const { send, mailer: m } = mailer();

    // Act
    const result = await m.send('khach@example.com', CONTENT);

    // Assert
    expect(result).toEqual({ status: 'sent' });

    // Verify
    const command = send.mock.calls[0]?.[0] as SendEmailCommand;
    expect(command).toBeInstanceOf(SendEmailCommand);
    expect(command.input).toMatchObject({
      FromEmailAddress: 'Black Magic <shop@example.com>',
      Destination: { ToAddresses: ['khach@example.com'] },
      Content: {
        Simple: {
          Subject: { Data: CONTENT.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: CONTENT.text, Charset: 'UTF-8' },
            Html: { Data: CONTENT.html, Charset: 'UTF-8' },
          },
        },
      },
    });
  });

  it.each([
    ['MessageRejected', 'not_verified'],
    ['MailFromDomainNotVerifiedException', 'not_verified'],
    ['SendingPausedException', 'sending_disabled'],
    ['AccountSuspendedException', 'sending_disabled'],
    ['TooManyRequestsException', 'throttled'],
  ])('send_returnsRejected_when%s', async (name, reason) => {
    // Arrange
    const { mailer: m } = mailer(vi.fn().mockRejectedValue(sesError(name)));

    // Act
    const result = await m.send('e2e-user@example.com', CONTENT);

    // Assert: thử lại vô ích nên không ném, tin không vào DLQ (An chốt 25/10)
    expect(result).toEqual({ status: 'rejected', reason });
  });

  it('send_throws_whenSesFailsTemporarily', async () => {
    // Arrange
    const { mailer: m } = mailer(vi.fn().mockRejectedValue(sesError('InternalFailure')));

    // Act
    const act = m.send('khach@example.com', CONTENT);

    // Assert: để SQS giao lại tin
    await expect(act).rejects.toThrow('InternalFailure');
  });

  it('sesClientConfig_usesAdaptiveRetry_withFourAttempts', () => {
    // Assert: sandbox 1 thư/giây; SDK tự chậm lại, trong timeout 10 giây của worker
    expect(sesClientConfig).toEqual({ retryMode: 'adaptive', maxAttempts: 4 });
  });
});
