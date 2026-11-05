import { RemovalPolicy, Tags, Validations } from 'aws-cdk-lib';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

export interface RecsTableProps {
  readonly shopEnv: ShopEnvironment;
}

/**
 * Bảng `recs` của module recommendation (dynamodb-design.md, nhóm chốt với Nhân ngày 22/10/2026).
 * Dòng gợi ý: `pk = <FOR_YOU | ALSO_BOUGHT | BESTSELLER>#<anchor>`, `sk = <phiên bản>#<hạng>`, hết hạn
 * theo cột `ttl` sau 7 ngày. Con trỏ: `pk = META`, `sk = ACTIVE#<loại>`, không có `ttl`.
 *
 * Pipeline mỗi đêm của Nhân ghi bảng; API gợi ý của An chỉ GetItem con trỏ và Query dòng gợi ý.
 */
export class RecsTable extends Construct {
  public readonly table: Table;

  constructor(scope: Construct, id: string, props: RecsTableProps) {
    super(scope, id);
    const { shopEnv } = props;

    this.table = new Table(this, 'Table', {
      partitionKey: { name: 'pk', type: AttributeType.STRING },
      sortKey: { name: 'sk', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: shopEnv.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
    Tags.of(this.table).add('module', 'recommendation');

    Validations.of(this.table).acknowledge({
      id: 'AwsSolutions-DDB3',
      reason:
        'Gợi ý tính lại được mỗi đêm từ bảng events và bucket dữ liệu huấn luyện, không cần point-in-time recovery (ADR-0012).',
    });
  }
}
