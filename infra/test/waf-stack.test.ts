import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { ApiStack } from '../lib/api-stack.js';
import type { ShopEnvironment } from '../lib/config.js';
import {
  COMMON_RULE_SET_COUNT_ONLY,
  RATE_LIMIT_ALL,
  RATE_LIMIT_EVENTS,
  WafStack,
} from '../lib/waf-stack.js';
import { WebStack } from '../lib/web-stack.js';

const prod: ShopEnvironment = { name: 'prod', stackPrefix: 'shop-prd', isProd: true };
const account = '111111111111';

function fakeWebDist(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'web-dist-'));
  mkdirSync(path.join(dir, 'assets'));
  writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>test</title>');
  return dir;
}

/** Ghép như infra/bin/shop.ts ở prod: WAF ở us-east-1, web ở ap-southeast-1 nhận ARN qua crossRegionReferences */
function synthProd(): { waf: Template; web: Template } {
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } });
  const env = { account, region: 'ap-southeast-1' };
  const api = new ApiStack(app, 'TestApi', { shopEnv: prod, env });
  const waf = new WafStack(app, 'TestWaf', {
    shopEnv: prod,
    env: { account, region: 'us-east-1' },
    crossRegionReferences: true,
  });
  const web = new WebStack(app, 'TestWeb', {
    shopEnv: prod,
    env,
    crossRegionReferences: true,
    httpApi: api.httpApi,
    userPoolId: api.userPool.userPoolId,
    userPoolClientId: api.webClient.userPoolClientId,
    webDistPath: fakeWebDist(),
    webAclArn: waf.webAclArn,
  });
  return { waf: Template.fromStack(waf), web: Template.fromStack(web) };
}

const { waf, web } = synthProd();

type Rule = { Name: string; Priority: number; Statement: Record<string, unknown> };
function rules(): Rule[] {
  const acls = Object.values(waf.findResources('AWS::WAFv2::WebACL'));
  expect(acls).toHaveLength(1);
  return (acls[0] as { Properties: { Rules: Rule[] } }).Properties.Rules;
}

describe('WafStack', () => {
  it('webAcl_isCloudFrontScope_inUsEast1_allowByDefault', () => {
    // Assert: CloudFront chỉ nhận web ACL scope CLOUDFRONT tạo ở us-east-1
    waf.hasResourceProperties('AWS::WAFv2::WebACL', {
      Scope: 'CLOUDFRONT',
      DefaultAction: { Allow: {} },
    });
  });

  it('webAcl_hasExactlyFiveRules_fromAdr0006', () => {
    // Assert: gói rule theo ADR-0006, đúng 5 rule để chi phí như đã ước tính
    expect(rules().map((r) => r.Name)).toEqual([
      'AWSManagedRulesAmazonIpReputationList',
      'RateLimitPerIp',
      'RateLimitEventsPerIp',
      'AWSManagedRulesCommonRuleSet',
      'AWSManagedRulesKnownBadInputsRuleSet',
    ]);
    expect(new Set(rules().map((r) => r.Priority)).size).toBe(5);
  });

  it('rateLimit_blocksPerIp_andEventsRuleOnlyMatchesEventsPath', () => {
    // Assert: rule chung và rule riêng cho /api/v1/events (threat model E2, E7) đều chặn theo IP
    waf.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'RateLimitPerIp',
          Action: { Block: {} },
          Statement: {
            RateBasedStatement: Match.objectLike({
              Limit: RATE_LIMIT_ALL,
              AggregateKeyType: 'IP',
              ScopeDownStatement: {
                ByteMatchStatement: Match.objectLike({ SearchString: '/api/' }),
              },
            }),
          },
        }),
        Match.objectLike({
          Name: 'RateLimitEventsPerIp',
          Action: { Block: {} },
          Statement: {
            RateBasedStatement: Match.objectLike({
              Limit: RATE_LIMIT_EVENTS,
              AggregateKeyType: 'IP',
              ScopeDownStatement: {
                ByteMatchStatement: Match.objectLike({
                  FieldToMatch: { UriPath: {} },
                  PositionalConstraint: 'STARTS_WITH',
                  SearchString: '/api/v1/events',
                }),
              },
            }),
          },
        }),
      ]),
    });
    expect(RATE_LIMIT_EVENTS).toBeLessThan(RATE_LIMIT_ALL);
  });

  it('commonRuleSet_onlyCounts_whileOtherManagedRulesBlock', () => {
    // Assert: core rule set dễ chặn nhầm nên chỉ đếm ở lần deploy đầu; IP reputation, known bad inputs chặn
    const override = (name: string) =>
      (rules().find((r) => r.Name === name) as { OverrideAction?: Record<string, unknown> })
        .OverrideAction;
    expect(COMMON_RULE_SET_COUNT_ONLY).toBe(true);
    expect(override('AWSManagedRulesCommonRuleSet')).toEqual({ Count: {} });
    expect(override('AWSManagedRulesAmazonIpReputationList')).toEqual({ None: {} });
    expect(override('AWSManagedRulesKnownBadInputsRuleSet')).toEqual({ None: {} });
  });

  it('logging_goesToWafLogGroup_andRedactsTokens', () => {
    // Assert: log WAF (C5) không chứa token Cognito trong header Authorization hay cookie
    waf.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: 'aws-waf-logs-shop-prd',
      RetentionInDays: 14,
    });
    waf.hasResourceProperties('AWS::WAFv2::LoggingConfiguration', {
      RedactedFields: [
        { SingleHeader: { Name: 'authorization' } },
        { SingleHeader: { Name: 'cookie' } },
      ],
    });
  });

  it('webStack_attachesWebAcl_whenArnGiven', () => {
    // Assert: distribution prod gắn web ACL (giá trị đọc từ us-east-1 qua crossRegionReferences)
    web.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({ WebACLId: Match.anyValue() }),
    });
  });
});
