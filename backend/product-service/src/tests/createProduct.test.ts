import { handler } from '../functions/createProduct';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('createProduct lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
  });

  it('should create a new product successfully', async () => {
    const testProduct = {
      title: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      count: 10
    };

    ddbMock
      .on(TransactWriteCommand)
      .resolves({});

    const event = {
      body: JSON.stringify(testProduct)
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body).toMatchObject(testProduct);
    expect(body.id).toBeDefined(); // Should have generated UUID
  });

  it('should return 400 for missing required fields', async () => {
    const invalidProduct = {
      title: 'Test Product',
      // missing description, price, count
    };

    const event = {
      body: JSON.stringify(invalidProduct)
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toHaveProperty('message');
  });

  it('should return 400 for invalid price', async () => {
    const invalidProduct = {
      title: 'Test Product',
      description: 'Test Description',
      price: -10, // negative price
      count: 10
    };

    const event = {
      body: JSON.stringify(invalidProduct)
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(400);
  });

  it('should return 400 for invalid count', async () => {
    const invalidProduct = {
      title: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      count: -5 // negative count
    };

    const event = {
      body: JSON.stringify(invalidProduct)
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(400);
  });

  it('should handle DynamoDB transaction errors', async () => {
    const testProduct = {
      title: 'Test Product',
      description: 'Test Description',
      price: 99.99,
      count: 10
    };

    ddbMock
      .on(TransactWriteCommand)
      .rejects(new Error('Transaction failed'));

    const event = {
      body: JSON.stringify(testProduct)
    };

    const response = await handler(event as any);

    expect(response.statusCode).toBe(500);
  });
});
