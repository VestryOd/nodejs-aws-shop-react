import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from '../functions/getProductsList';
import { mockProducts } from '../mocks/products';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('getProductsList lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('should return all products with stocks', async () => {
    // Mock DynamoDB responses
    ddbMock
      .on(ScanCommand, { TableName: process.env.PRODUCTS_TABLE })
      .resolves({
        Items: mockProducts.map(({ count, ...product }) => product)
      });

    ddbMock
      .on(ScanCommand, { TableName: process.env.STOCKS_TABLE })
      .resolves({
        Items: mockProducts.map(product => ({
          product_id: product.id,
          count: product.count
        }))
      });
    const mockEvent = {} as APIGatewayProxyEvent;
    const mockContext = {} as Context;

    const response = await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;
    // const response = await handler();

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveLength(mockProducts.length);
    expect(body[0]).toHaveProperty('id');
    expect(body[0]).toHaveProperty('count');
  });

  it('should handle DynamoDB errors gracefully', async () => {
    ddbMock
      .on(ScanCommand)
      .rejects(new Error('DynamoDB error'));
    const mockEvent = {} as APIGatewayProxyEvent;
    const mockContext = {} as Context;

    const response = await await handler(mockEvent, mockContext, () => {}) as APIGatewayProxyResult;

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toHaveProperty('message');
  });
});

