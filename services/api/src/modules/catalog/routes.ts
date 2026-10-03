import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { z } from 'zod';
import { json, validationProblem, type HttpResult } from '../../shared/http/response.js';
import type { ProductView } from './application/getProduct.js';

/** Use case mà handler cần. lambda.ts truyền bản thật, test truyền mock. */
export interface CatalogUseCases {
  getProduct(input: { readonly id: string }): Promise<ProductView>;
}

type Route = (event: APIGatewayProxyEventV2, useCases: CatalogUseCases) => Promise<HttpResult>;

const productParams = z.object({
  id: z
    .string()
    .regex(/^[A-Za-z0-9-]{1,64}$/, 'id chỉ gồm chữ, số và dấu gạch ngang, tối đa 64 ký tự'),
});

/** Bảng route → use case. Khoá phải trùng route khai báo trong HTTP API ở infra/. */
export const routes: Readonly<Record<string, Route>> = {
  'GET /api/v1/products/{id}': async (event, { getProduct }) => {
    const params = productParams.safeParse(event.pathParameters ?? {});
    if (!params.success) return validationProblem(params.error, event.requestContext.requestId);
    return json(200, await getProduct({ id: params.data.id }));
  },
};
