import { Tags } from 'aws-cdk-lib';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { EmailSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

export interface MonitoringProps {
  readonly shopEnv: ShopEnvironment;
  /**
   * Email nhận cảnh báo, truyền bằng `-c alarmEmail=...` (CI lấy từ secret ALARM_EMAIL).
   * Không ghi vào code vì repo public. Thiếu thì vẫn tạo topic, chỉ không có ai nhận.
   */
  readonly alarmEmail?: string;
}

/**
 * Giám sát của một môi trường (engineering-plan.md mục giám sát): SNS topic nhận cảnh báo.
 * Bước sau thêm alarm (API 5xx, Lambda lỗi, throttle, độ trễ) và dashboard vào đây.
 */
export class Monitoring extends Construct {
  /** Topic mọi alarm gửi vào; ai đăng ký topic sẽ nhận email khi alarm chuyển ALARM hoặc OK. */
  public readonly alarmTopic: Topic;

  constructor(scope: Construct, id: string, props: MonitoringProps) {
    super(scope, id);
    const { shopEnv, alarmEmail } = props;

    this.alarmTopic = new Topic(this, 'AlarmTopic', {
      // Không mã hoá bằng KMS: nội dung cảnh báo không nhạy cảm, và khoá mặc định alias/aws/sns
      // không cho CloudWatch gửi tin vào; khoá KMS riêng tốn khoảng $1/tháng mỗi môi trường.
      // Hiện ở dòng người gửi của email, để biết cảnh báo đến từ môi trường nào
      displayName: `shop-ai ${shopEnv.name}`,
      // Từ chối mọi lời gọi tới topic không qua HTTPS
      enforceSSL: true,
    });

    // Người nhận phải bấm "Confirm subscription" trong email đầu tiên AWS gửi tới
    if (alarmEmail) {
      this.alarmTopic.addSubscription(new EmailSubscription(alarmEmail));
    }

    Tags.of(this).add('module', 'monitoring');
  }
}
