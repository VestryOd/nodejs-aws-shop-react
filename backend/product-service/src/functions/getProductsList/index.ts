import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

export const handler: APIGatewayProxyHandler = async (): Promise<APIGatewayProxyResult> => {
  console.log('getProductsList lambda invoked');
  try {
    const productsCommand = new ScanCommand({
      TableName: process.env.PRODUCTS_TABLE!
    });

    const stocksCommand = new ScanCommand({
      TableName: process.env.STOCKS_TABLE!
    });

    const [products, stocks] = await Promise.all([
      docClient.send(productsCommand),
      docClient.send(stocksCommand)
    ]);

    const joinedProducts = products.Items?.map(product => ({
      ...product,
      count: stocks.Items?.find(stock => stock.product_id === product.id)?.count || 0
    }));
    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(joinedProducts)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
