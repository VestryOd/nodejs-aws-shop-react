import { handler } from '../functions/getProductById';
import { mockProducts } from '../mocks/products';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { createMockEvent } from "./test-utils";

const ddbMock = mockClient(DynamoDBDocumentClient);

describe('getProductById lambda', () => {
  beforeEach(() => {
    ddbMock.reset();
    // Set environment variables for tests
    process.env.PRODUCTS_TABLE = 'products-table';
    process.env.STOCKS_TABLE = 'stocks-table';
  });

  it('should return product by id', async () => {
    const testProduct = mockProducts[0];

    // Mock both DynamoDB calls
    ddbMock
      .on(GetCommand, {
        TableName: process.env.PRODUCTS_TABLE,
        Key: { id: testProduct.id }
      })
      .resolves({
        Item: {
          id: testProduct.id,
          title: testProduct.title,
          description: testProduct.description,
          price: testProduct.price
        }
      });

    ddbMock
      .on(GetCommand, {
        TableName: process.env.STOCKS_TABLE,
        Key: { product_id: testProduct.id }
      })
      .resolves({
        Item: {
          product_id: testProduct.id,
          count: testProduct.count
        }
      });

    const event = createMockEvent({ id: testProduct.id });
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.id).toBe(testProduct.id);
    expect(body.count).toBe(testProduct.count);
  });

  it('should return 404 for non-existent product', async () => {
    // Mock product not found
    ddbMock
      .on(GetCommand, {
        TableName: process.env.PRODUCTS_TABLE,
        Key: { id: 'non-existent-id' }
      })
      .resolves({ Item: undefined });

    const event = createMockEvent({ id: 'non-existent-id' });
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

    const event = createMockEvent({ id: 'some-id' });
    const response = await handler(event);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toHaveProperty('message', 'Internal server error');
  });
});

