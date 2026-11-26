import { Duration, RemovalPolicy, Stack, Tags, Validations } from 'aws-cdk-lib';
import { Function as CloudFrontFunction, FunctionCode } from 'aws-cdk-lib/aws-cloudfront';
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import type { ShopEnvironment } from './config.js';

/**
 * Ảnh sản phẩm admin tải lên (catalog.md BR-16, hạ tầng #561). Luồng: Lambda admin sản phẩm (stack api)
 * ký presigned POST, trình duyệt POST thẳng file lên bucket, khách đọc ảnh qua CloudFront (stack web) ở
 * `/images/products/<ULID>.<jpg|png|webp>`.
 */

/** Tiền tố khoá ảnh trong bucket, trùng imageKey của services/api/src/modules/catalog/domain/productImage.ts */
export const PRODUCT_IMAGES_KEY_PREFIX = 'products/';
/** Đường dẫn ảnh trên CloudFront; Function bỏ `/images` để ra đúng khoá `products/...` */
export const PRODUCT_IMAGES_PATH_PATTERN = '/images/products/*';

/**
 * Tên bucket cố định, dùng chung cho hai stack. OAC của CloudFront cần bucket policy trỏ tới ARN
 * distribution, nên bucket phải nằm cùng stack web; stack api (Lambda ký vé) lại không được tham chiếu
 * stack web vì stack web đã phụ thuộc stack api (httpApi, userPool). Hai stack cùng tính tên từ cấu hình,
 * không ai export cho ai.
 *
 * Dùng `stackPrefix` (sandbox ra shop-sbx-<tên>) và account để không trùng tên toàn cầu của S3.
 * Hệ quả của tên cố định: prod để RETAIN, nên nếu xoá stack web rồi deploy lại thì CloudFormation báo
 * bucket đã tồn tại; khi đó import bucket cũ vào stack hoặc xoá tay sau khi sao lưu ảnh.
 */
export function productImagesBucketName(shopEnv: ShopEnvironment, account: string): string {
  return `${shopEnv.stackPrefix}-product-images-${account}`;
}

/** Tham số SSM chứa tên miền shop `https://<cloudfront>`; stack web ghi, Lambda admin sản phẩm đọc */
export function shopBaseUrlParameterName(shopEnv: ShopEnvironment): string {
  return `/shop/${shopEnv.name}/web/base-url`;
}

export interface ProductImagesProps {
  readonly shopEnv: ShopEnvironment;
}

/** Bucket ảnh và CloudFront Function đổi đường dẫn, đặt trong stack web */
export class ProductImages extends Construct {
  public readonly bucket: Bucket;
  /** Gắn vào behavior `/images/products/*` ở viewer-request */
  public readonly pathRewrite: CloudFrontFunction;

  constructor(scope: Construct, id: string, props: ProductImagesProps) {
    super(scope, id);
    const { shopEnv } = props;
    this.bucket = new Bucket(this, 'Bucket', {
      // Account là token khi synth không có env (CI, test); CloudFormation ghép chuỗi lúc deploy
      bucketName: productImagesBucketName(shopEnv, Stack.of(this).account),
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      // Presigned POST từ trình duyệt admin đi thẳng tới S3 nên cần CORS. AllowedOrigins '*' vì tên miền
      // CloudFront chỉ có sau khi distribution tạo xong (cùng stack, đặt vào thì vòng phụ thuộc giữa bucket
      // và distribution). Không mở thêm quyền: mỗi lượt POST vẫn phải có vé ký bởi Lambda admin (điều kiện
      // khoá, loại, cỡ 1 B … 3 MB, hết hạn 300 giây); CORS chỉ cho trình duyệt đọc được phản hồi.
      cors: [
        {
          allowedMethods: [HttpMethods.POST],
          allowedOrigins: ['*'],
          maxAge: 3600,
        },
      ],
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(1) }],
      // prod giữ lại khi xoá stack; môi trường khác xoá cả file bên trong (như bucket web)
      removalPolicy: shopEnv.isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !shopEnv.isProd,
    });
    Tags.of(this.bucket).add('module', 'catalog');
    Validations.of(this.bucket).acknowledge({
      id: 'AwsSolutions-S1',
      reason:
        'Ảnh sản phẩm công khai; log truy cập S3 tốn thêm một bucket. Ai tải ảnh lên đã ghi ở log Lambda admin (UPLOAD_IMAGE).',
    });

    // Ảnh nằm ở khoá `products/<ULID>.<ext>`; CloudFront chuyển nguyên đường dẫn sang S3, mà originPath
    // chỉ thêm được tiền tố nên phải bỏ `/images` ở đây
    this.pathRewrite = new CloudFrontFunction(this, 'PathRewrite', {
      comment: 'shop-ai: /images/products/* -> products/* trong bucket ảnh',
      code: FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  if (request.uri.indexOf('/images/') === 0) {
    request.uri = request.uri.substring('/images'.length);
  }
  return request;
}`),
    });
  }
}
