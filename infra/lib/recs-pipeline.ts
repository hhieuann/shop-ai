import { cpSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import {
  AssetHashType,
  Duration,
  Tags,
  TimeZone,
  Validations,
  type RemovalPolicy,
} from 'aws-cdk-lib';
import type { Table } from 'aws-cdk-lib/aws-dynamodb';
import { PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { Architecture, Code, Function, Runtime, Tracing } from 'aws-cdk-lib/aws-lambda';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Schedule, ScheduleExpression } from 'aws-cdk-lib/aws-scheduler';
import { LambdaInvoke } from 'aws-cdk-lib/aws-scheduler-targets';
import { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

const REPO_ROOT = path.join(import.meta.dirname, '..', '..');
const DATA_SRC = path.join(REPO_ROOT, 'data', 'src');
const SEED_PRODUCTS = path.join(REPO_ROOT, 'services', 'api', 'seed', 'catalog', 'products.json');

export interface RecsPipelineProps {
  readonly shopEnv: ShopEnvironment;
  readonly removalPolicy: RemovalPolicy;
  /** Bảng `recs`: pipeline ghi dòng gợi ý và con trỏ */
  readonly recs: Table;
  /** Bảng `products` của catalog: chỉ Scan 4 cột (ADR-0017) */
  readonly products: Table;
  /** Bảng `events`: chỉ Scan (ADR-0017) */
  readonly events: Table;
}

/**
 * Job gợi ý mỗi đêm (recommendation.md mục 3): EventBridge Scheduler gọi Lambda Python lúc 02:00 giờ
 * Việt Nam. Code là `data/src` (thư viện chuẩn, boto3 có sẵn trong runtime), kèm file seed products.json
 * để dev, staging sinh dữ liệu giả lập có tên, giá thật (nhóm chốt 22/10/2026). Prod chỉ dùng sự kiện thật.
 */
export class RecsPipeline extends Construct {
  public readonly fn: Function;

  constructor(scope: Construct, id: string, props: RecsPipelineProps) {
    super(scope, id);
    const { shopEnv, removalPolicy, recs, products, events } = props;

    this.fn = new Function(this, 'Function', {
      runtime: Runtime.PYTHON_3_14,
      architecture: Architecture.ARM_64,
      handler: 'data.pipeline.lambda_handler.handler',
      code: Code.fromAsset(DATA_SRC, {
        // Hash theo nội dung đã đóng gói, để đổi products.json cũng tạo bản Lambda mới
        assetHashType: AssetHashType.OUTPUT,
        bundling: {
          image: Runtime.PYTHON_3_14.bundlingImage,
          // Chỉ chép file, không cần Docker; Docker là đường dự phòng nếu chép lỗi
          command: ['bash', '-c', 'cp -r /asset-input/. /asset-output/'],
          local: {
            tryBundle(outputDir: string) {
              cpSync(DATA_SRC, outputDir, {
                recursive: true,
                filter: (src) => !src.includes('__pycache__'),
              });
              mkdirSync(path.join(outputDir, 'seed'), { recursive: true });
              cpSync(SEED_PRODUCTS, path.join(outputDir, 'seed', 'products.json'));
              return true;
            },
          },
        },
      }),
      // Dữ liệu demo tính dưới 1 giây; phần lâu là ghi vài nghìn dòng recs bằng BatchWriteItem
      memorySize: 512,
      timeout: Duration.minutes(5),
      tracing: Tracing.ACTIVE,
      logGroup: new LogGroup(this, 'Logs', { retention: RetentionDays.TWO_WEEKS, removalPolicy }),
      environment: {
        RECS_TABLE: recs.tableName,
        PRODUCTS_TABLE: products.tableName,
        EVENTS_TABLE: events.tableName,
        SYNTHETIC: shopEnv.isProd ? '0' : '1',
        PRODUCTS_JSON: '/var/task/seed/products.json',
      },
    });

    // recs: ghi dòng và con trỏ (BatchWriteItem), đọc con trỏ, gia hạn ttl phiên bản đang bật
    this.fn.addToRolePolicy(
      new PolicyStatement({
        actions: [
          'dynamodb:BatchWriteItem',
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:Query',
          'dynamodb:UpdateItem',
        ],
        resources: [recs.tableArn],
      }),
    );
    // products: chỉ Scan đúng 4 cột (ADR-0017); thiếu ProjectionExpression thì IAM từ chối
    this.fn.addToRolePolicy(
      new PolicyStatement({
        actions: ['dynamodb:Scan'],
        resources: [products.tableArn],
        conditions: {
          'ForAllValues:StringEquals': {
            'dynamodb:Attributes': ['productId', 'category', 'status', 'createdAt'],
          },
          StringEqualsIfExists: { 'dynamodb:Select': 'SPECIFIC_ATTRIBUTES' },
        },
      }),
    );
    // events: Scan chỉ đọc (ADR-0017); không có userId thật trong bảng (events.md mục 2)
    this.fn.addToRolePolicy(
      new PolicyStatement({ actions: ['dynamodb:Scan'], resources: [events.tableArn] }),
    );

    // Role riêng để ghi lý do cdk-nag ngay tại đây; LambdaInvoke chỉ cấp lambda:InvokeFunction trên hàm này
    const schedulerRole = new Role(this, 'SchedulerRole', {
      assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
    });
    new Schedule(this, 'Nightly', {
      description: `shop-ai ${shopEnv.name}: job gợi ý mỗi đêm`,
      schedule: ScheduleExpression.cron({
        minute: '0',
        hour: '2',
        timeZone: TimeZone.ASIA_HO_CHI_MINH,
      }),
      // Job chạy lại trong ngày ra cùng phiên bản (idempotent) nên thử lại an toàn
      target: new LambdaInvoke(this.fn, {
        role: schedulerRole,
        retryAttempts: 2,
        maxEventAge: Duration.hours(1),
      }),
    });
    Validations.of(schedulerRole).acknowledge({
      id: 'AwsSolutions-IAM5[Resource::<RecsPipelineFunction36568FF8.Arn>:*]',
      reason:
        'CDK cấp lambda:InvokeFunction cho hàm và các phiên bản của chính hàm đó (ARN:*), không hàm nào khác.',
    });

    Tags.of(this).add('module', 'recommendation');
    Validations.of(this.fn).acknowledge(
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason: 'Policy có sẵn của AWS, chỉ cho Lambda tạo log stream và ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'X-Ray bắt buộc Resource "*" cho xray:PutTraceSegments và xray:PutTelemetryRecords.',
      },
    );
  }
}
