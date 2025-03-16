import {SQSEvent, Context, SQSRecord} from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuid } from 'uuid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);
const snsClient = new SNSClient({});
const sqsClient = new SQSClient({});
const { PRODUCTS_TABLE, STOCKS_TABLE, SNS_TOPIC_ARN, SQS_QUEUE_URL } = process.env;

interface ProductData {
  title: string;
  description: string;
  price: number;
  count: number;
}

async function publishToSns(products: ProductData[], status: 'success' | 'failure', error?: string) {
  for (const product of products) {
    const message = {
      status,
      product: {
        ...product,
        price: Number(product.price),
        count: Number(product.count)
      },
      ...(error && { error }),
    };

    await snsClient.send(new PublishCommand({
      TopicArn: SNS_TOPIC_ARN,
      Subject: `Product Creation ${status === 'success' ? 'Succeeded' : 'Failed'}`,
      Message: JSON.stringify(message, null, 2),
      MessageAttributes: {
        price: {
          DataType: 'Number',
          StringValue: Math.round(product.price).toString(),
        },
      },
    }));
  }
}

export async function retryUnprocessedItems(unprocessedItems: Record<string, any>): Promise<void> {
  let items = unprocessedItems;
  let retryCount = 0;
  const maxRetries = 3;

  while (Object.keys(items).length > 0 && retryCount < maxRetries) {
    retryCount++;
    console.log(`Retry attempt ${retryCount} for unprocessed items`);

    const retryResult = await docClient.send(new BatchWriteCommand({
      RequestItems: items
    }));

    items = retryResult.UnprocessedItems || {};
  }

  if (Object.keys(items).length > 0) {
    throw new Error(`Failed to process all items after ${maxRetries} retries`);
  }
}

export async function deleteMessages(sqsClient: SQSClient, queueUrl: string, records: SQSRecord[]): Promise<void> {
  const deletePromises = records.map(record =>
    sqsClient.send(new DeleteMessageCommand({
      QueueUrl: queueUrl,
      ReceiptHandle: record.receiptHandle
    }))
  );

  await Promise.all(deletePromises);
}

export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  if (!event.Records || event.Records.length === 0) {
    return;
  }

  if (!PRODUCTS_TABLE || !STOCKS_TABLE || !SNS_TOPIC_ARN || !SQS_QUEUE_URL) {
    throw new Error('Required environment variables are not set');
  }

  try {
    console.log('Received event:', JSON.stringify(event, null, 2));
    const productWrites = [];
    const stockWrites = [];
    const productIds = [];

    for (const record of event.Records) {
      const product = JSON.parse(record.body);
      const productId = product.id || uuid();
      productIds.push(productId);

      // Idempotency check
      const existingProduct = await docClient.send(new GetCommand({
        TableName: PRODUCTS_TABLE,
        Key: { id: productId }
      }));

      if (existingProduct?.Item) {
        console.log(`Product ${productId} already exists, skipping`);
        continue;
      }

      productWrites.push({
        PutRequest: {
          Item: {
            id: productId,
            title: product.title,
            description: product.description,
            price: Number(product.price),
            createdAt: new Date().toISOString()
          }
        }
      });

      stockWrites.push({
        PutRequest: {
          Item: {
            product_id: productId,
            count: Number(product.count)
          }
        }
      });
    }

    if (productWrites.length === 0) {
      console.log('No new products to process');
      await deleteMessages(sqsClient, SQS_QUEUE_URL, event.Records);
      return;
    }

    const batchWriteCommand = new BatchWriteCommand({
      RequestItems: {
        [PRODUCTS_TABLE]: productWrites,
        [STOCKS_TABLE]: stockWrites
      }
    });

    const result = await docClient.send(batchWriteCommand);

    if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
      console.warn('Some items were not processed, attempting retry...');
      await retryUnprocessedItems(result.UnprocessedItems);
      for (const record of event.Records) {
        const productData = JSON.parse(record.body);
        await publishToSns([productData], 'success');
      }
    } else {
      for (const record of event.Records) {
        const productData = JSON.parse(record.body);
        await publishToSns([productData], 'success');
      }
    }

    // Delete messages after successful processing
    await deleteMessages(sqsClient, SQS_QUEUE_URL, event.Records);
    console.log(`Successfully processed ${event.Records.length} messages`);
  } catch (error) {
    console.error('Error processing messages:', error);
    await publishToSns(
      event.Records.map(r => JSON.parse(r.body)),
      'failure',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }
};
