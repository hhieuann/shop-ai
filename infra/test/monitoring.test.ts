import { App, Stack } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import type { ShopEnvironment } from '../lib/config.js';
import { Monitoring } from '../lib/monitoring.js';

const dev: ShopEnvironment = { name: 'dev', stackPrefix: 'shop-dev', isProd: false };

/** Dựng Monitoring trong một stack trống: test chỉ phần giám sát, không cần cả ApiStack. */
function synth(alarmEmail?: string): Template {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { region: 'ap-southeast-1' } });
  new Monitoring(stack, 'Monitoring', { shopEnv: dev, ...(alarmEmail ? { alarmEmail } : {}) });
  return Template.fromStack(stack);
}

describe('Monitoring', () => {
  it('alarmTopic_isCreatedOnce', () => {
    // Act
    const template = synth('test@example.com');

    // Assert: mọi alarm của môi trường gửi vào cùng một topic
    template.resourceCountIs('AWS::SNS::Topic', 1);
  });

  it('alarmTopic_sendsEmail_whenAlarmEmailGiven', () => {
    // Act
    const template = synth('test@example.com');

    // Assert
    template.hasResourceProperties('AWS::SNS::Subscription', {
      Protocol: 'email',
      Endpoint: 'test@example.com',
    });
  });

  it('alarmTopic_hasNoSubscription_whenAlarmEmailMissing', () => {
    // Act: repo public nên email không nằm trong code; thiếu context thì chỉ tạo topic
    const template = synth();

    // Assert
    template.resourceCountIs('AWS::SNS::Subscription', 0);
  });

  it('alarmTopic_rejectsRequestsWithoutTls', () => {
    // Act
    const template = synth('test@example.com');

    // Assert: topic policy từ chối mọi lời gọi không qua HTTPS
    template.hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Deny',
            Condition: { Bool: { 'aws:SecureTransport': 'false' } },
          }),
        ]),
      },
    });
  });

  it('alarmSubscription_logicalIdDoesNotContainEmail', () => {
    // Act
    const template = synth('test@example.com');

    // Assert: GitHub chỉ che nguyên văn secret; tên tài nguyên ghép từ email (bỏ @ và .) sẽ lộ ra log CI
    expect(JSON.stringify(template.toJSON())).not.toContain('testexamplecom');
  });

  it('monitoring_throws_whenAlarmEmailInvalid', () => {
    // Act + Assert: secret gõ thiếu "@gmail.com" phải bị chặn lúc synth, không đợi CloudFormation rollback
    expect(() => synth('hieuannguyen2k6')).toThrow('alarmEmail không hợp lệ');
  });
});
