import { Duration, Stack, Tags } from 'aws-cdk-lib';
import type { IHttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import {
  Alarm,
  AlarmStatusWidget,
  ComparisonOperator,
  Dashboard,
  GraphWidget,
  Metric,
  Stats,
  TreatMissingData,
  type IMetric,
} from 'aws-cdk-lib/aws-cloudwatch';
import { SnsAction } from 'aws-cdk-lib/aws-cloudwatch-actions';
import { PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import type { IFunction } from 'aws-cdk-lib/aws-lambda';
import type { IQueue } from 'aws-cdk-lib/aws-sqs';
import { Subscription, SubscriptionProtocol, Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

/** Đủ để bắt lỗi gõ thiếu như "ten" hay "ten@gmail"; không cần khớp đầy đủ chuẩn email. */
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export interface MonitoringProps {
  readonly shopEnv: ShopEnvironment;
  /** HTTP API cần canh 5xx và độ trễ */
  readonly httpApi: IHttpApi;
  /** Lambda do Cognito gọi khi đăng ký: lỗi của nó không hiện ở 5xx của API */
  readonly preSignUpFn: IFunction;
  /** Lambda đứng sau API, theo tên module: vẽ lỗi và thời gian chạy của từng hàm trên dashboard */
  readonly apiFunctions: Readonly<Record<string, IFunction>>;
  /** Lambda chạy nền (đọc SQS), theo tên: vẽ chung với Lambda API trên dashboard */
  readonly workerFunctions?: Readonly<Record<string, IFunction>>;
  /** Hàng đợi đơn của worker order-processor: tuổi tin cũ nhất cho runbook sqs-backlog */
  readonly ordersQueue?: IQueue;
  /** DLQ của hàng đợi đơn: có tin là có đơn worker xử lý lỗi quá 3 lần, còn kẹt ở PENDING */
  readonly ordersDeadLetterQueue?: IQueue;
  /**
   * Email nhận cảnh báo, truyền bằng `-c alarmEmail=...` (CI lấy từ secret ALARM_EMAIL).
   * Không ghi vào code vì repo public. Thiếu thì vẫn tạo topic, chỉ không có ai nhận.
   */
  readonly alarmEmail?: string;
}

/**
 * Giám sát của một môi trường (engineering-plan.md mục giám sát): SNS topic nhận cảnh báo,
 * alarm 5xx, độ trễ p95, lỗi pre sign-up, throttle (prod). Bước sau thêm dashboard vào đây.
 */
export class Monitoring extends Construct {
  /** Topic mọi alarm gửi vào; ai đăng ký topic sẽ nhận email khi alarm chuyển ALARM hoặc OK. */
  public readonly alarmTopic: Topic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);
    const { shopEnv, alarmEmail } = props;

    // Chặn lúc synth thay vì đợi CloudFormation báo lỗi rồi rollback. Không in email ra: log CI công khai
    if (alarmEmail !== undefined && !EMAIL.test(alarmEmail)) {
      throw new Error('alarmEmail không hợp lệ: kiểm lại secret ALARM_EMAIL hoặc -c alarmEmail');
    }

    // Không mã hoá bằng KMS: nội dung cảnh báo không nhạy cảm, và khoá mặc định alias/aws/sns
    // không cho CloudWatch gửi tin vào; khoá KMS riêng tốn khoảng $1/tháng mỗi môi trường.
    this.alarmTopic = new Topic(this, 'AlarmTopic', {
      // Hiện ở dòng người gửi của email, để biết cảnh báo đến từ môi trường nào
      displayName: `shop-ai ${shopEnv.name}`,
      // Từ chối mọi lời gọi tới topic không qua HTTPS
      enforceSSL: true,
    });

    // enforceSSL tạo topic policy mới, thay mất policy mặc định cho phép trong tài khoản.
    // Phải cho CloudWatch (dịch vụ AWS) gửi tin vào, chỉ từ alarm của chính tài khoản này.
    const { account, region } = Stack.of(this);
    this.alarmTopic.addToResourcePolicy(
      new PolicyStatement({
        sid: 'AllowCloudWatchAlarms',
        principals: [new ServicePrincipal('cloudwatch.amazonaws.com')],
        actions: ['sns:Publish'],
        resources: [this.alarmTopic.topicArn],
        conditions: {
          StringEquals: { 'aws:SourceAccount': account },
          ArnLike: { 'aws:SourceArn': `arn:aws:cloudwatch:${region}:${account}:alarm:*` },
        },
      }),
    );

    // Người nhận phải bấm "Confirm subscription" trong email đầu tiên AWS gửi tới
    if (alarmEmail) {
      new Subscription(this, 'AlarmEmailSubscription', {
        topic: this.alarmTopic,
        protocol: SubscriptionProtocol.EMAIL,
        endpoint: alarmEmail,
      });
    }

    // Mỗi metric alarm tốn $0,10/tháng sau 10 metric miễn phí của cả tài khoản:
    // dev 3 + staging 3 + prod 4 = 10. Sandbox không có alarm; diễn tập trên dev bằng set-alarm-state.
    if (shopEnv.name !== 'sbx') {
      const period = Duration.minutes(5);
      const alarms: Alarm[] = [];
      const addAlarm = (
        id: string,
        name: string,
        metric: IMetric,
        threshold: number,
        evaluationPeriods: number,
        runbook: string,
      ) => {
        const alarm = new Alarm(this, id, {
          alarmName: `${shopEnv.stackPrefix}-${name}`,
          alarmDescription: `Xử lý theo docs/runbooks/${runbook}.md`,
          metric,
          threshold,
          evaluationPeriods,
          comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          // Không có request thì coi là bình thường, không báo
          treatMissingData: TreatMissingData.NOT_BREACHING,
        });
        // Báo khi có sự cố và báo khi đã ổn
        alarm.addAlarmAction(new SnsAction(this.alarmTopic));
        alarm.addOkAction(new SnsAction(this.alarmTopic));
        alarms.push(alarm);
      };

      addAlarm(
        'ApiServerErrorsAlarm',
        'api-5xx',
        props.httpApi.metricServerError({ period, statistic: Stats.SUM }),
        3,
        1,
        'api-5xx',
      );
      // 3 chu kỳ 5 phút liền để một lần khởi động lạnh không làm alarm kêu
      addAlarm(
        'ApiLatencyAlarm',
        'api-latency-p95',
        props.httpApi.metricLatency({ period, statistic: Stats.p(95) }),
        1000,
        3,
        'api-latency',
      );
      addAlarm(
        'PreSignUpErrorsAlarm',
        'presignup-errors',
        props.preSignUpFn.metricErrors({ period, statistic: Stats.SUM }),
        1,
        1,
        'lambda-errors',
      );
      // Alarm mới chỉ tạo ở prod: dev, staging, prod chung tài khoản và hạn mức 10 alarm miễn phí
      // (nhóm chốt 24/10/2026); ở dev, staging xem DLQ trên dashboard và console SQS
      if (shopEnv.isProd && props.ordersDeadLetterQueue) {
        addAlarm(
          'OrdersDeadLetterAlarm',
          'orders-dlq',
          props.ordersDeadLetterQueue.metricApproximateNumberOfMessagesVisible({
            period,
            statistic: Stats.MAXIMUM,
          }),
          1,
          1,
          'dlq-orders',
        );
        // Đơn đã ghi mà không gửi được tin cho worker (ordering.md, luồng SQS bước 1): metric do
        // Lambda ordering ghi bằng Powertools Metrics, namespace = tiền tố stack, dimension service
        addAlarm(
          'OrderEnqueueFailedAlarm',
          'order-enqueue-failed',
          new Metric({
            namespace: shopEnv.stackPrefix,
            metricName: 'OrderEnqueueFailed',
            dimensionsMap: { service: 'ordering' },
            period,
            statistic: Stats.SUM,
          }),
          1,
          1,
          'dlq-orders',
        );
      }
      // Giới hạn Lambda chạy cùng lúc tính chung cả tài khoản (không dimension), nên chỉ canh ở prod
      if (shopEnv.isProd) {
        addAlarm(
          'LambdaThrottlesAlarm',
          'lambda-throttles',
          new Metric({
            namespace: 'AWS/Lambda',
            metricName: 'Throttles',
            period,
            statistic: Stats.SUM,
          }),
          1,
          1,
          'lambda-throttle',
        );
      }

      // Dashboard "Shop tổng quan": runbook mở trang này trước tiên
      const { httpApi, preSignUpFn, apiFunctions, workerFunctions } = props;
      const fns = { ...apiFunctions, ...workerFunctions, presignup: preSignUpFn };
      const dashboard = new Dashboard(this, 'Dashboard', {
        dashboardName: `${shopEnv.stackPrefix}-overview`,
        defaultInterval: Duration.hours(3),
      });
      dashboard.addWidgets(
        new AlarmStatusWidget({ title: 'Cảnh báo', alarms, width: 24, height: 3 }),
      );
      dashboard.addWidgets(
        new GraphWidget({
          title: 'API: request và lỗi (mỗi 5 phút)',
          left: [httpApi.metricCount({ period, statistic: Stats.SUM, label: 'request' })],
          right: [
            httpApi.metricClientError({ period, statistic: Stats.SUM, label: '4xx' }),
            httpApi.metricServerError({ period, statistic: Stats.SUM, label: '5xx' }),
          ],
          width: 12,
        }),
        new GraphWidget({
          title: 'API: độ trễ (ms)',
          left: [
            httpApi.metricLatency({ period, statistic: Stats.p(50), label: 'p50' }),
            httpApi.metricLatency({ period, statistic: Stats.p(95), label: 'p95' }),
          ],
          leftAnnotations: [{ value: 300, label: 'Mục tiêu p95' }],
          width: 12,
        }),
      );
      dashboard.addWidgets(
        new GraphWidget({
          title: 'Lambda: lỗi theo hàm',
          left: Object.entries(fns).map(([label, fn]) =>
            fn.metricErrors({ period, statistic: Stats.SUM, label }),
          ),
          width: 8,
        }),
        new GraphWidget({
          title: 'Lambda: thời gian chạy p95 (ms)',
          left: Object.entries(fns).map(([label, fn]) =>
            fn.metricDuration({ period, statistic: Stats.p(95), label }),
          ),
          width: 8,
        }),
        new GraphWidget({
          title: 'Lambda cả tài khoản: chạy cùng lúc (giới hạn 1.000)',
          left: [
            new Metric({
              namespace: 'AWS/Lambda',
              metricName: 'ConcurrentExecutions',
              period: Duration.minutes(1),
              statistic: Stats.MAXIMUM,
              label: 'chạy cùng lúc',
            }),
          ],
          right: [
            new Metric({
              namespace: 'AWS/Lambda',
              metricName: 'Throttles',
              period,
              statistic: Stats.SUM,
              label: 'throttle',
            }),
          ],
          width: 8,
        }),
      );
      // Hàng đợi đơn ở mọi môi trường, không alarm (dev, staging không có alarm; runbook sqs-backlog)
      const { ordersQueue, ordersDeadLetterQueue } = props;
      if (ordersQueue && ordersDeadLetterQueue) {
        dashboard.addWidgets(
          new GraphWidget({
            title: 'Hàng đợi đơn: tuổi tin cũ nhất (giây)',
            left: [
              ordersQueue.metricApproximateAgeOfOldestMessage({
                period,
                statistic: Stats.MAXIMUM,
                label: 'tin cũ nhất',
              }),
            ],
            width: 12,
          }),
          new GraphWidget({
            title: 'Hàng đợi đơn: tin đang chờ và tin trong DLQ',
            left: [
              ordersQueue.metricApproximateNumberOfMessagesVisible({
                period,
                statistic: Stats.MAXIMUM,
                label: 'đang chờ',
              }),
            ],
            right: [
              ordersDeadLetterQueue.metricApproximateNumberOfMessagesVisible({
                period,
                statistic: Stats.MAXIMUM,
                label: 'DLQ',
              }),
            ],
            width: 12,
          }),
        );
      }
    }

    Tags.of(this).add('module', 'monitoring');
  }
}
