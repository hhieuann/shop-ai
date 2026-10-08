import type { CfnResource } from 'aws-cdk-lib';
import {
  CfnOutput,
  Duration,
  Fn,
  RemovalPolicy,
  Stack,
  Token,
  Validations,
  type StackProps,
} from 'aws-cdk-lib';
import type { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import {
  AllowedMethods,
  CacheCookieBehavior,
  CacheHeaderBehavior,
  CachePolicy,
  CacheQueryStringBehavior,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  OriginRequestPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, Source } from 'aws-cdk-lib/aws-s3-deployment';
import type { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

export interface WebStackProps extends StackProps {
  readonly shopEnv: ShopEnvironment;
  /** HTTP API của stack api; CloudFront chuyển /api/* sang đây. */
  readonly httpApi: HttpApi;
  /** Thư mục bản build web (apps/web/dist). */
  readonly webDistPath: string;
}

/**
 * Web của shop theo ADR-0006: một CloudFront cho mỗi môi trường.
 * `/` đọc bucket S3 riêng tư qua Origin Access Control; `/api/*` sang API Gateway, cùng tên miền nên không có CORS.
 * WAF và gói CloudFront Free làm ở bước sau.
 */
export class WebStack extends Stack {
  constructor(scope: Construct, id: string, props: WebStackProps) {
    super(scope, id, props);
    const { shopEnv, httpApi, webDistPath } = props;

    const bucket = new Bucket(this, 'WebBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // prod giữ lại khi xoá stack; môi trường khác xoá cả file bên trong
      removalPolicy: shopEnv.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !shopEnv.isProd,
    });

    // Đường dẫn không có đuôi file (vd. /products/abc) là route của React, trả index.html
    const spaRewrite = new CloudFrontFunction(this, 'SpaRewrite', {
      code: FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  if (request.uri.indexOf('.') === -1) {
    request.uri = '/index.html';
  }
  return request;
}`),
    });

    // apiEndpoint dạng https://<id>.execute-api.<region>.amazonaws.com, CloudFront chỉ cần phần tên miền
    const apiDomain = Fn.select(2, Fn.split('/', httpApi.apiEndpoint));
    const apiOrigin = new HttpOrigin(apiDomain);

    // Danh sách và chi tiết sản phẩm là công khai, chấp nhận chậm tối đa 60 giây (catalog.md).
    // Khoá cache gồm mọi query string (q, category, sort, limit, cursor), không có header hay cookie.
    const productsCache = new CachePolicy(this, 'ProductsCache', {
      comment: 'shop-ai: sản phẩm công khai, cache 60 giây',
      defaultTtl: Duration.seconds(60),
      maxTtl: Duration.seconds(60),
      minTtl: Duration.seconds(0),
      queryStringBehavior: CacheQueryStringBehavior.all(),
      headerBehavior: CacheHeaderBehavior.none(),
      cookieBehavior: CacheCookieBehavior.none(),
      enableAcceptEncodingGzip: true,
      enableAcceptEncodingBrotli: true,
    });

    const distribution = new Distribution(this, 'Distribution', {
      comment: `shop-ai web (${shopEnv.name})`,
      defaultRootObject: 'index.html',
      // Gồm châu Á; rẻ hơn PriceClass_All
      priceClass: PriceClass.PRICE_CLASS_200,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          { function: spaRewrite, eventType: FunctionEventType.VIEWER_REQUEST },
        ],
      },
      // CloudFront so khớp theo thứ tự: /api/v1/products* phải đứng trước /api/*
      additionalBehaviors: {
        '/api/v1/products*': {
          origin: apiOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_GET_HEAD,
          cachePolicy: productsCache,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
        '/api/*': {
          origin: apiOrigin,
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          // Chuyển query, header (trừ Host) và cookie sang API; Host phải là tên miền của API Gateway
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    // File có hash trong tên không bao giờ đổi nội dung nên không xoá (prune: false): trang đang mở
    // ở bản cũ vẫn tải được. Chỉ index.html đổi theo mỗi bản, nên invalidate đúng file đó.
    new BucketDeployment(this, 'DeployWeb', {
      sources: [Source.asset(webDistPath)],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/index.html'],
      prune: false,
      memoryLimit: 512,
    });

    Validations.of(this).acknowledge(
      {
        id: 'AwsSolutions-S1',
        reason:
          'Bucket chỉ chứa web tĩnh công khai; log truy cập S3 tốn thêm mà không cần cho demo.',
      },
      {
        id: 'AwsSolutions-CFR1',
        reason: 'Shop bán cho khách ở mọi nơi; không chặn theo quốc gia.',
      },
      {
        id: 'AwsSolutions-CFR2',
        reason: 'WAF gắn ở bước sau theo ADR-0006 (gói CloudFront Free có 5 rule WAF).',
      },
      {
        id: 'AwsSolutions-CFR3',
        reason: 'Log truy cập CloudFront tốn S3 và chưa cần ở giai đoạn này; bật khi làm giám sát.',
      },
      {
        id: 'AwsSolutions-CFR4',
        reason:
          'Dùng chứng chỉ mặc định *.cloudfront.net, CloudFront không cho chọn TLS tối thiểu; chưa có tên miền riêng.',
      },
      {
        id: 'AwsSolutions-IAM4[Policy::arn:<AWS::Partition>:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole]',
        reason:
          'Lambda do CDK tự sinh (BucketDeployment, tự xoá file trong bucket) chỉ ghi log CloudWatch.',
      },
      {
        id: 'AwsSolutions-IAM5[Action::s3:GetBucket*]',
        reason:
          'Quyền đọc/ghi do CDK cấp cho Lambda BucketDeployment, chỉ trên bucket web và bucket asset.',
      },
      {
        id: 'AwsSolutions-IAM5[Action::s3:GetObject*]',
        reason: 'Như trên: Lambda BucketDeployment chép bản build từ bucket asset sang bucket web.',
      },
      {
        id: 'AwsSolutions-IAM5[Action::s3:List*]',
        reason: 'Như trên.',
      },
      {
        id: 'AwsSolutions-IAM5[Action::s3:DeleteObject*]',
        reason: 'Như trên.',
      },
      {
        id: 'AwsSolutions-IAM5[Action::s3:Abort*]',
        reason: 'Như trên.',
      },
      {
        // Bucket asset do CDK bootstrap tạo, tên chứa account và region nên tính ra thay vì ghi cứng
        id: `AwsSolutions-IAM5[Resource::arn:aws:s3:::cdk-hnb659fds-assets-${Token.isUnresolved(this.account) ? '<AWS::AccountId>' : this.account}-${this.region}/*]`,
        reason: 'Lambda BucketDeployment đọc bản build web từ bucket asset của CDK bootstrap.',
      },
      {
        id: `AwsSolutions-IAM5[Resource::<${this.getLogicalId(bucket.node.defaultChild as CfnResource)}.Arn>/*]`,
        reason:
          'Lambda BucketDeployment ghi file web vào đúng bucket web, mọi đường dẫn trong bucket.',
      },
      {
        id: 'AwsSolutions-IAM5[Resource::*]',
        reason:
          'cloudfront:CreateInvalidation không giới hạn được theo distribution trong policy CDK sinh ra.',
      },
      {
        id: 'AwsSolutions-L1',
        reason:
          'Runtime của Lambda do CDK tự chọn cho BucketDeployment và tự xoá file; cập nhật theo phiên bản CDK.',
      },
    );

    new CfnOutput(this, 'WebUrl', { value: `https://${distribution.distributionDomainName}` });
    new CfnOutput(this, 'WebBucketName', { value: bucket.bucketName });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
  }
}
