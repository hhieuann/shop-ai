// File nạp của Lambda account. Không có phụ thuộc nào cần ráp nên dùng thẳng handler, chỉ bọc X-Ray.
import { withTracing } from '../../shared/tracer.js';
import { handler as httpHandler } from './handler.js';

export const handler = withTracing(httpHandler);
