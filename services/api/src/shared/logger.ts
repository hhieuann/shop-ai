import { Logger } from '@aws-lambda-powertools/logger';

/** Log JSON. Tên service lấy từ POWERTOOLS_SERVICE_NAME do CDK đặt cho từng Lambda. */
export const logger = new Logger();
