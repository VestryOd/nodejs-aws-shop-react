import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const log = (message: string) => {
  console.log(message);
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { productId } = event.pathParameters || {};
    log(`getProductsById lambda invoked with params: ${JSON.stringify(event.pathParameters)}`);

    if (!productId) {
      return {
        statusCode: 400,
        headers: {
          ...headers,
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Missing product ID' }),
      };
    }

    // Get product details
    const productResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.PRODUCTS_TABLE,
        Key: { id: productId },
      })
    );

    // If product not found, return 404
    if (!productResponse.Item) {
      return {
        statusCode: 404,
        headers: {
          ...headers,
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Product not found' }),
      };
    }

    // Get stock information
    const stockResponse = await docClient.send(
      new GetCommand({
        TableName: process.env.STOCKS_TABLE,
        Key: { product_id: productId },
      })
    );

    // Combine product and stock information
    const product = {
      ...productResponse.Item,
      count: stockResponse.Item?.count || 0,
    };

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(product),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
