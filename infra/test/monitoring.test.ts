import { App, Duration, Stack } from 'aws-cdk-lib';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { Code, Function as LambdaFunction, Runtime } from 'aws-cdk-lib/aws-lambda';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { describe, expect, it } from 'vitest';
import type { ShopEnvironment } from '../lib/config.js';
import { Monitoring } from '../lib/monitoring.js';

const dev: ShopEnvironment = { name: 'dev', stackPrefix: 'shop-dev', isProd: false };
const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };
const sbx: ShopEnvironment = { name: 'sbx', stackPrefix: 'shop-sbx-an', isProd: false };

/**
 * Dựng Monitoring trong một stack trống cùng HTTP API và vài Lambda giả (pre sign-up, catalog, cart):
 * test chỉ phần giám sát, không cần cả ApiStack.
 */
function synth(alarmEmail?: string, shopEnv: ShopEnvironment = dev): Template {
  const app = new App();
  const stack = new Stack(app, 'TestStack', { env: { region: 'ap-southeast-1' } });
  const httpApi = new HttpApi(stack, 'Api');
  const fakeFunction = (id: string) =>
    new LambdaFunction(stack, id, {
      runtime: Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: Code.fromInline('exports.handler = async (e) => e;'),
      timeout: Duration.seconds(3),
    });
  new Monitoring(stack, 'Monitoring', {
    shopEnv,
    httpApi,
    preSignUpFn: fakeFunction('PreSignUp'),
    apiFunctions: { catalog: fakeFunction('Catalog'), cart: fakeFunction('Cart') },
    ...(alarmEmail ? { alarmEmail } : {}),
  });
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

  // Alarm: mỗi metric trong alarm tốn $0,10/tháng sau 10 metric miễn phí của cả tài khoản,
  // nên chọn ít alarm mà đủ phát hiện sự cố: dev 3 + staging 3 + prod 4 = 10.

  it('alarms_areThree_whenDev', () => {
    // Act
    const template = synth('test@example.com', dev);

    // Assert: 5xx của API, độ trễ p95 của API, lỗi Lambda pre sign-up
    template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
  });

  it('alarms_addAccountThrottle_whenProd', () => {
    // Act
    const template = synth('test@example.com', prod);

    // Assert: giới hạn 10 Lambda chạy cùng lúc là của cả tài khoản, nên chỉ canh một lần ở prod
    template.resourceCountIs('AWS::CloudWatch::Alarm', 4);
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'shop-prd-lambda-throttles',
      Namespace: 'AWS/Lambda',
      MetricName: 'Throttles',
      Dimensions: Match.absent(),
    });
  });

  it('alarms_areNotCreated_whenSandbox', () => {
    // Act: sandbox không tốn metric alarm; diễn tập cảnh báo làm trên dev bằng set-alarm-state
    const template = synth('test@example.com', sbx);

    // Assert
    template.resourceCountIs('AWS::CloudWatch::Alarm', 0);
  });

  it('apiServerErrorsAlarm_firesOnThreeFiveXxInFiveMinutes', () => {
    // Act
    const template = synth('test@example.com', dev);

    // Assert
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'shop-dev-api-5xx',
      Namespace: 'AWS/ApiGateway',
      MetricName: '5xx',
      Statistic: 'Sum',
      Period: 300,
      EvaluationPeriods: 1,
      Threshold: 3,
      ComparisonOperator: 'GreaterThanOrEqualToThreshold',
      TreatMissingData: 'notBreaching',
    });
  });

  it('apiLatencyAlarm_firesWhenP95AboveOneSecondForFifteenMinutes', () => {
    // Act
    const template = synth('test@example.com', dev);

    // Assert: 3 chu kỳ 5 phút liền để một lần khởi động lạnh không làm alarm kêu
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'shop-dev-api-latency-p95',
      MetricName: 'Latency',
      ExtendedStatistic: 'p95',
      Period: 300,
      EvaluationPeriods: 3,
      Threshold: 1000,
      TreatMissingData: 'notBreaching',
    });
  });

  it('preSignUpErrorsAlarm_firesOnFirstError', () => {
    // Act
    const template = synth('test@example.com', dev);

    // Assert: pre sign-up lỗi là không ai đăng ký được, và lỗi này không hiện ở 5xx của API
    template.hasResourceProperties('AWS::CloudWatch::Alarm', {
      AlarmName: 'shop-dev-presignup-errors',
      Namespace: 'AWS/Lambda',
      MetricName: 'Errors',
      Threshold: 1,
    });
  });

  it('everyAlarm_notifiesTopicOnAlarmAndOnRecovery', () => {
    // Act
    const template = synth('test@example.com', prod);

    // Assert: báo khi có sự cố và báo khi đã ổn, kèm đường dẫn runbook trong mô tả
    const alarms = Object.values(template.findResources('AWS::CloudWatch::Alarm')) as {
      Properties: { AlarmActions?: unknown[]; OKActions?: unknown[]; AlarmDescription?: string };
    }[];
    for (const alarm of alarms) {
      expect(alarm.Properties.AlarmActions).toHaveLength(1);
      expect(alarm.Properties.OKActions).toHaveLength(1);
      expect(alarm.Properties.AlarmDescription).toContain('docs/runbooks/');
    }
  });
  it('alarmTopic_allowsCloudWatchAlarmsToPublish', () => {
    // Act
    const template = synth('test@example.com');

    // Assert: thiếu dòng này CloudWatch báo "not authorized to perform SNS:Publish" (diễn tập 12/10)
    template.hasResourceProperties('AWS::SNS::TopicPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({
            Effect: 'Allow',
            Principal: { Service: 'cloudwatch.amazonaws.com' },
            Action: 'sns:Publish',
          }),
        ]),
      },
    });
  });

  // Dashboard: 3 dashboard đầu tiên của tài khoản miễn phí, nên mỗi môi trường dùng chung một cái

  it('dashboard_isNamedPerEnvironment_whenDev', () => {
    // Act
    const template = synth('test@example.com', dev);

    // Assert
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 1);
    template.hasResourceProperties('AWS::CloudWatch::Dashboard', {
      DashboardName: 'shop-dev-overview',
    });
  });

  it('dashboard_isNotCreated_whenSandbox', () => {
    // Act
    const template = synth('test@example.com', sbx);

    // Assert
    template.resourceCountIs('AWS::CloudWatch::Dashboard', 0);
  });

  it('dashboard_showsAlarmsApiLambdasAndAccountConcurrency', () => {
    // Act
    const template = synth('test@example.com', prod);

    // Assert: đọc nội dung dashboard (JSON ghép từ nhiều phần) thành một chuỗi để tìm
    const body = JSON.stringify(
      Object.values(template.findResources('AWS::CloudWatch::Dashboard'))[0],
    );
    expect(body).toContain('ApiServerErrorsAlarm'); // ô trạng thái alarm
    expect(body).toContain('5xx');
    expect(body).toContain('Latency');
    expect(body).toContain('\\"label\\":\\"catalog\\"'); // mỗi Lambda một đường, có nhãn tên module
    expect(body).toContain('ConcurrentExecutions'); // so với giới hạn 1.000 của tài khoản
  });

  it('dashboard_showsWorkerAndOrdersQueue_withoutNewAlarm_whenDev', () => {
    // Arrange: như synth() nhưng thêm worker và hàng đợi đơn
    const app = new App();
    const stack = new Stack(app, 'TestStack', { env: { region: 'ap-southeast-1' } });
    const fakeFunction = (id: string) =>
      new LambdaFunction(stack, id, {
        runtime: Runtime.NODEJS_24_X,
        handler: 'index.handler',
        code: Code.fromInline('exports.handler = async (e) => e;'),
        timeout: Duration.seconds(3),
      });
    new Monitoring(stack, 'Monitoring', {
      shopEnv: dev,
      httpApi: new HttpApi(stack, 'Api'),
      preSignUpFn: fakeFunction('PreSignUp'),
      apiFunctions: { catalog: fakeFunction('Catalog') },
      workerFunctions: { 'order-processor': fakeFunction('Worker') },
      ordersQueue: new Queue(stack, 'OrdersQueue'),
      ordersDeadLetterQueue: new Queue(stack, 'OrdersDlq'),
    });

    // Act
    const template = Template.fromStack(stack);

    // Assert: runbook sqs-backlog đọc các widget này; dev vẫn chỉ 3 alarm như trước
    const body = JSON.stringify(
      Object.values(template.findResources('AWS::CloudWatch::Dashboard'))[0],
    );
    expect(body).toContain('\\"label\\":\\"order-processor\\"');
    expect(body).toContain('ApproximateAgeOfOldestMessage');
    expect(body).toContain('\\"label\\":\\"DLQ\\"');
    template.resourceCountIs('AWS::CloudWatch::Alarm', 3);
  });
});
