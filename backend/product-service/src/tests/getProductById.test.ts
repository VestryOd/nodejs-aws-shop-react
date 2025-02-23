// src/tests/getProductById.test.ts
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../functions/getProductById';
import { mockProducts } from '../layers/nodejs/data/mockProducts';

describe('getProductById', () => {
  it('should return product when found', async () => {
    const mockEvent = {
      pathParameters: { productId: mockProducts[0].id }
    } as unknown as APIGatewayProxyEvent;
    const mockContext = {} as Context;

    const result = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(mockProducts[0]);
  });

  it('should return 404 when product not found', async () => {
    const mockEvent = {
      pathParameters: { productId: 'nonexistent' }
    } as unknown as APIGatewayProxyEvent;
    const mockContext = {} as Context;

    const result = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(404);
  });
});
