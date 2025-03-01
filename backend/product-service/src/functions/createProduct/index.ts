// createProduct.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.log('createProduct lambda invoked with body:', event.body);

  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'Missing request body' }),
      };
    }

    const { title, description, price, count } = JSON.parse(event.body || '');

    // Validate input
    if (!title || typeof price !== 'number' || typeof count !== 'number' || price < 0 || count < 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid product data' })
      };
    }

    const productId = uuidv4();

    const command = new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: process.env.PRODUCTS_TABLE!,
            Item: {
              id: productId,
              title,
              description,
              price
            }
          }
        },
        {
          Put: {
            TableName: process.env.STOCKS_TABLE!,
            Item: {
              product_id: productId,
              count
            }
          }
        }
      ]
    });

    await docClient.send(command);

    return {
      statusCode: 201,
      headers: {
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        id: productId,
        title,
        description,
        price,
        count,
      }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};
