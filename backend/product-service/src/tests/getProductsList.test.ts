// src/tests/getProductsList.test.ts
import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../functions/getProductsList';
import { mockProducts } from '../layers/nodejs/data/mockProducts';

describe('getProductsList', () => {
  it('should return all products', async () => {
    const mockEvent = {} as APIGatewayProxyEvent;
    const mockContext = {} as Context;

    const result = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;

    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body).toEqual(mockProducts);
  });
});
