import { ArnFormat, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnLoggingConfiguration, CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

/** Ngưỡng của rule giới hạn tốc độ, đếm request `/api/` theo IP trong 5 phút (cửa sổ mặc định của WAF) */
export const RATE_LIMIT_ALL = 1000;
export const RATE_LIMIT_EVENTS = 300;

export interface WafStackProps extends StackProps {
  readonly shopEnv: ShopEnvironment;
}

function visibility(metricName: string): CfnWebACL.VisibilityConfigProperty {
  return { cloudWatchMetricsEnabled: true, metricName, sampledRequestsEnabled: true };
}

/**
 * Rule managed của AWS. `countOnly`: chỉ đếm và ghi log, không chặn; dùng cho rule dễ chặn nhầm trong
 * những ngày đầu, xem log rồi mới chuyển sang chặn (docs/runbooks/waf.md).
 */
function managedRule(name: string, priority: number, countOnly = false): CfnWebACL.RuleProperty {
  return {
    name,
    priority,
    statement: { managedRuleGroupStatement: { vendorName: 'AWS', name } },
    overrideAction: countOnly ? { count: {} } : { none: {} },
    visibilityConfig: visibility(name),
  };
}

function pathStartsWith(searchString: string): CfnWebACL.StatementProperty {
  return {
    byteMatchStatement: {
      fieldToMatch: { uriPath: {} },
      positionalConstraint: 'STARTS_WITH',
      searchString,
      textTransformations: [{ priority: 0, type: 'NONE' }],
    },
  };
}

/**
 * Core rule set chỉ đếm cho tới khi xem log sau lần deploy prod đầu (v1.0.0-rc.1); đổi thành false bằng
 * PR riêng khi log không có chặn nhầm. Các rule còn lại chặn ngay vì ít khả năng nhầm.
 */
export const COMMON_RULE_SET_COUNT_ONLY = true;

/**
 * WAF cho CloudFront theo ADR-0006 (cập nhật 29/10/2026): web ACL scope CLOUDFRONT bắt buộc nằm ở
 * us-east-1 nên tách stack riêng; trả theo dùng và chỉ tạo ở prod (khoảng $5 web ACL + $1 mỗi rule mỗi
 * tháng). Stack web nhận ARN qua crossRegionReferences.
 *
 * 5 rule: core rule set, known bad inputs, IP reputation, giới hạn tốc độ chung theo IP, và giới hạn
 * riêng cho `/api/v1/events` (threat model E2, E7: tài khoản ảo spam sự kiện).
 */
export class WafStack extends Stack {
  public readonly webAclArn: string;

  constructor(scope: Construct, id: string, props: WafStackProps) {
    super(scope, id, props);
    const { shopEnv } = props;
    const prefix = shopEnv.stackPrefix;

    const webAcl = new CfnWebACL(this, 'WebAcl', {
      name: `${prefix}-web`,
      description: `shop-ai ${shopEnv.name} WAF cho CloudFront, ADR-0006`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: visibility(`${prefix}-web`),
      rules: [
        // Rule rẻ, chặn sớm IP xấu đã biết trước khi tốn công kiểm nội dung
        managedRule('AWSManagedRulesAmazonIpReputationList', 10),
        {
          // Chỉ đếm request API: file tĩnh do CloudFront cache, một lần mở trang tải hàng chục file nên
          // nhiều người chung Wi-Fi (một IP) lúc demo dễ chạm ngưỡng nếu đếm cả file tĩnh
          name: 'RateLimitPerIp',
          priority: 20,
          statement: {
            rateBasedStatement: {
              limit: RATE_LIMIT_ALL,
              aggregateKeyType: 'IP',
              scopeDownStatement: pathStartsWith('/api/'),
            },
          },
          action: { block: {} },
          visibilityConfig: visibility('RateLimitPerIp'),
        },
        {
          // Sự kiện xem hàng, thêm giỏ: người thật không gửi tới 300 lượt trong 5 phút
          name: 'RateLimitEventsPerIp',
          priority: 30,
          statement: {
            rateBasedStatement: {
              limit: RATE_LIMIT_EVENTS,
              aggregateKeyType: 'IP',
              scopeDownStatement: pathStartsWith('/api/v1/events'),
            },
          },
          action: { block: {} },
          visibilityConfig: visibility('RateLimitEventsPerIp'),
        },
        managedRule('AWSManagedRulesCommonRuleSet', 40, COMMON_RULE_SET_COUNT_ONLY),
        managedRule('AWSManagedRulesKnownBadInputsRuleSet', 50),
      ],
    });
    this.webAclArn = webAcl.attrArn;

    // Tên log group của WAF bắt buộc bắt đầu bằng aws-waf-logs-; giữ 14 ngày như access log API (C5)
    const logs = new LogGroup(this, 'Logs', {
      logGroupName: `aws-waf-logs-${prefix}`,
      retention: RetentionDays.TWO_WEEKS,
      removalPolicy: shopEnv.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
    new CfnLoggingConfiguration(this, 'Logging', {
      resourceArn: webAcl.attrArn,
      // WAF nhận ARN log group không có hậu tố ":*" (logGroupArn của CDK có hậu tố này)
      logDestinationConfigs: [
        this.formatArn({
          service: 'logs',
          resource: 'log-group',
          resourceName: logs.logGroupName,
          arnFormat: ArnFormat.COLON_RESOURCE_NAME,
        }),
      ],
      // Không ghi header Authorization, cookie vào log: chứa token Cognito
      redactedFields: [
        { singleHeader: { Name: 'authorization' } },
        { singleHeader: { Name: 'cookie' } },
      ],
    });
  }
}
