import { handler } from '../functions/getProductById';
import { mockProducts } from '../mocks/products';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { createMockEvent } from "./test-utils";
import * as productModule from '../functions/getProductById';

describe('getProductById lambda', () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
    // Ensure the mock is properly applied to the client instance
    Object.defineProperty(productModule, 'ddbDocClient', {
      value: ddbMock
    });
  });

  it('should return product by id', async () => {
    const testProduct = {
      id: 'test-id',
      title: 'Test Product',
      description: 'Test Description',
      price: 100,
      count: 10
    };

    ddbMock.on(GetCommand).resolves({
      Item: testProduct
    });

    const event = createMockEvent({ productId: 'test-id' });
    const response = await handler(event);

    // Verify the DynamoDB call
    expect(ddbMock.calls()).toHaveLength(2);
    const getCommandInput = ddbMock.calls()[0].args[0].input;
    expect(getCommandInput).toEqual({
      TableName: expect.any(String),
      Key: {
        id: 'test-id'
      }
    });

    // Verify the response
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual(testProduct);
  });

  it('should return 404 for non-existent product', async () => {
    // Mock product not found
    ddbMock
      .on(GetCommand, {
        TableName: process.env.PRODUCTS_TABLE,
        Key: { id: 'non-existent-id' }
      })
      .resolves({ Item: undefined });

    const event = createMockEvent({ productId: 'non-existent-id' });
    const response = await handler(event);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toHaveProperty('message', 'Product not found');
  });

  it('should return 400 for missing id parameter', async () => {
    const event = createMockEvent(null);
    const response = await handler(event);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toHaveProperty('message', 'Missing product ID');
  });

  it('should return 500 for database errors', async () => {
    ddbMock
      .on(GetCommand)
      .rejects(new Error('Database error'));

    const event = createMockEvent({ productId: 'some-id' });
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toHaveProperty('message', 'Internal server error');
  });
});

