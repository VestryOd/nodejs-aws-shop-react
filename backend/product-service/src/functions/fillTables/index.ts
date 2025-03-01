// src/functions/fillTables/index.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { mockProducts } from '../../mocks/products';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event: any): Promise<any> => {
  console.log('Starting to fill tables with mock data');

  try {
    for (const product of mockProducts) {
      const command = new TransactWriteCommand({
        TransactItems: [
          {
            Put: {
              TableName: process.env.PRODUCTS_TABLE!,
              Item: {
                id: product.id,
                title: product.title,
                description: product.description,
                price: product.price
              }
            }
          },
          {
            Put: {
              TableName: process.env.STOCKS_TABLE!,
              Item: {
                product_id: product.id,
                count: product.count
              }
            }
          }
        ]
      });

      await docClient.send(command);
      console.log(`Added product: ${product.title}`);
    }

    return {
      Status: 'SUCCESS',
      PhysicalResourceId: 'FillTablesFunction',
      Data: {
        Message: `Successfully added ${mockProducts.length} products`
      }
    };
  } catch (error) {
    console.error('Error filling tables:', error);
    return {
      Status: 'FAILED',
      PhysicalResourceId: 'FillTablesFunction',
      Reason: JSON.stringify(error)
    };
  }
};
