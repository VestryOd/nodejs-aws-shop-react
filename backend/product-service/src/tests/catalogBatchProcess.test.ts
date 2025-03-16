import {Context, SQSEvent, SQSRecord, SQSRecordAttributes} from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import {
  DynamoDBDocumentClient,
  BatchWriteCommand,
  BatchWriteCommandInput,
  PutCommand,
  GetCommand
} from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import {SQSClient, SendMessageCommand, DeleteMessageBatchCommand, DeleteMessageCommand} from '@aws-sdk/client-sqs';
import {deleteMessages, handler, retryUnprocessedItems} from '../functions/catalogBatchProcess';

const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);
const sqsMock = mockClient(SQSClient);

const testProducts = [
  {
    title: 'Test Product 1',
    description: 'Test Description 1',
    price: 100,
    count: 10
  },
  {
    title: 'Test Product 2',
    description: 'Test Description 2',
    price: 200,
    count: 20
  }
];

type ProductItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  createdAt: string;
};

type StockItem = {
  product_id: string;
  count: number;
};

const context: Context = {
  awsRequestId: 'test-request-id',
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'test-arn',
  memoryLimitInMB: '128',
  callbackWaitsForEmptyEventLoop: true,
  getRemainingTimeInMillis: () => 1000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
} as unknown as Context;

describe('catalogBatchProcess handler', () => {

  beforeEach(() => {
    ddbMock.reset();
    snsMock.reset();
    sqsMock.reset();

    ddbMock.on(PutCommand).resolves({});
    ddbMock.on(BatchWriteCommand).resolves({ UnprocessedItems: {} });
    snsMock.on(PublishCommand).resolves({ MessageId: 'test-message-id' });
    sqsMock.on(SendMessageCommand).resolves({
      MessageId: 'test-message-id'
    });
  });

  it('should process products batch and save to both tables', async () => {
    const testProducts = [
      {
        title: 'Test Product 1',
        description: 'Description 1',
        price: 100,
        count: 10
      },
      {
        title: 'Test Product 2',
        description: 'Description 2',
        price: 200,
        count: 20
      }
    ];

    const event: SQSEvent = {
      Records: testProducts.map(product => ({
        messageId: 'test-id',
        receiptHandle: 'test-handle',
        body: JSON.stringify(product),
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1545082649183',
          SenderId: 'AIDAIOA23YSOP5WBOTK',
          ApproximateFirstReceiveTimestamp: '1545082649185'
        },
        messageAttributes: {},
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'test:arn',
        awsRegion: 'us-east-1'
      }))
    };

    await handler(event, {} as Context);

    // Verify all DynamoDB calls
    const getCalls = ddbMock.commandCalls(GetCommand);
    const batchWriteCalls = ddbMock.commandCalls(BatchWriteCommand);

    expect(getCalls).toHaveLength(2);
    expect(batchWriteCalls).toHaveLength(1);

    const batchWriteInput = batchWriteCalls[0].args[0].input as BatchWriteCommandInput;
    expect(batchWriteInput.RequestItems).toBeDefined();

    // Verify products table writes
    // @ts-ignore
    const productWrites = batchWriteInput.RequestItems[process.env.PRODUCTS_TABLE!];
    expect(productWrites).toHaveLength(2);
    productWrites.forEach((write, index) => {
      const item = write.PutRequest?.Item as ProductItem;
      expect(item).toMatchObject({
        title: testProducts[index].title,
        description: testProducts[index].description,
        price: testProducts[index].price,
        id: expect.any(String),
        createdAt: expect.any(String)
      });
    });

    // Verify stocks table writes
    // @ts-ignore
    const stockWrites = batchWriteInput.RequestItems[process.env.STOCKS_TABLE!];
    expect(stockWrites).toHaveLength(2);
    stockWrites.forEach((write, index) => {
      const item = write.PutRequest?.Item as StockItem;
      expect(item).toMatchObject({
        count: testProducts[index].count,
        product_id: expect.any(String)
      });

      const productItem = productWrites[index].PutRequest?.Item as ProductItem;
      expect(item.product_id).toBe(productItem.id);
    });

    // Verify SNS notifications
    const snsCalls = snsMock.calls();
    expect(snsCalls).toHaveLength(2);

    snsCalls.forEach((call, index) => {
      const params = call.args[0].input;
      expect(params).toMatchObject({
        TopicArn: 'test-topic-arn',
        Subject: 'Product Creation Succeeded',
        Message: expect.any(String), // Add this if you're sending a message body
        MessageAttributes: {
          price: {
            DataType: 'Number',
            StringValue: testProducts[index].price.toString()
          }
        }
      });
    });
  });

  it('should handle empty event', async () => {
    // Arrange
    const emptyEvent: SQSEvent = { Records: [] };

    // Act
    await handler(emptyEvent, {} as Context);

    // Assert
    // Verify no calls were made to DynamoDB or SNS
    expect(ddbMock.calls()).toHaveLength(0);
    expect(snsMock.calls()).toHaveLength(0);
  });

  it('should handle undefined Records', async () => {
    // Arrange
    const emptyEvent = { Records: undefined } as unknown as SQSEvent;

    // Act
    await handler(emptyEvent, {} as Context);

    // Assert
    // Verify no calls were made to DynamoDB or SNS
    expect(ddbMock.calls()).toHaveLength(0);
    expect(snsMock.calls()).toHaveLength(0);
  });

  it('should handle DynamoDB errors', async () => {
    const event: SQSEvent = {
      Records: [{
        messageId: 'test-message-id',
        receiptHandle: 'test-receipt-handle',
        body: JSON.stringify(testProducts[0]),
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1545082649183',
          SenderId: 'XXXXXXXXXXXXXXXXXXXXX',
          ApproximateFirstReceiveTimestamp: '1545082649185'
        },
        messageAttributes: {},
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'test-arn',
        awsRegion: 'us-east-1'
      }]
    };

    ddbMock.on(BatchWriteCommand).rejects(new Error('DB Error'));
    await expect(handler(event, context)).rejects.toThrow('DB Error');
  });

  it('should handle invalid JSON in SQS message', async () => {
    const invalidEvent: SQSEvent = {
      Records: [{
        messageId: 'test-message-id',
        receiptHandle: 'test-receipt-handle',
        body: 'invalid json',
        attributes: {
          ApproximateReceiveCount: '1',
          SentTimestamp: '1545082649183',
          SenderId: 'XXXXXXXXXXXXXXXXXXXXX',
          ApproximateFirstReceiveTimestamp: '1545082649185'
        },
        messageAttributes: {},
        md5OfBody: 'test-md5',
        eventSource: 'aws:sqs',
        eventSourceARN: 'test-arn',
        awsRegion: 'us-east-1'
      }]
    };

    await expect(handler(invalidEvent, context)).rejects.toThrow();
  });
});

describe('retryUnprocessedItems', () => {
  const ddbMock = mockClient(DynamoDBDocumentClient);

  beforeEach(() => {
    ddbMock.reset();
  });

  it('should retry unprocessed items successfully', async () => {
    // Mock first attempt fails with unprocessed items, second attempt succeeds
    ddbMock
      .on(BatchWriteCommand)
      .resolvesOnce({
        UnprocessedItems: {
          'TestTable': [
            {
              PutRequest: {
                Item: { id: '1', title: 'Test' }
              }
            }
          ]
        }
      })
      .resolvesOnce({
        UnprocessedItems: {}
      });

    const unprocessedItems = {
      'TestTable': [
        {
          PutRequest: {
            Item: { id: '1', title: 'Test' }
          }
        }
      ]
    };

    await retryUnprocessedItems(unprocessedItems);

    // Verify BatchWrite was called twice
    expect(ddbMock.calls()).toHaveLength(2);
  });

  it('should handle empty unprocessed items', async () => {
    const unprocessedItems = {};
    await retryUnprocessedItems(unprocessedItems);

    // Verify no BatchWrite calls were made
    expect(ddbMock.calls()).toHaveLength(0);
  });

  it('should throw error after max retries', async () => {
    // Mock all attempts return unprocessed items
    ddbMock.on(BatchWriteCommand).resolves({
      UnprocessedItems: {
        'TestTable': [
          {
            PutRequest: {
              Item: { id: '1', title: 'Test' }
            }
          }
        ]
      }
    });

    const unprocessedItems = {
      'TestTable': [
        {
          PutRequest: {
            Item: { id: '1', title: 'Test' }
          }
        }
      ]
    };

    await expect(retryUnprocessedItems(unprocessedItems))
      .rejects
      .toThrow('Failed to process all items after 3 retries');
  });
});

describe('deleteMessages', () => {
  // Create a real SQSClient instance
  const realSqsClient = new SQSClient({});
  // Create the mock
  const sqsMock = mockClient(SQSClient);
  const queueUrl = 'test-queue-url';

  beforeEach(() => {
    sqsMock.reset();
  });

  it('should delete messages successfully', async () => {
    // Mock successful deletion
    sqsMock.on(DeleteMessageCommand).resolves({});

    const records: SQSRecord[] = [
      {
        messageId: '1',
        receiptHandle: 'receipt1',
        body: 'test1',
        attributes: {} as SQSRecordAttributes,
        messageAttributes: {},
        md5OfBody: '',
        eventSource: '',
        eventSourceARN: '',
        awsRegion: '',
      },
      {
        messageId: '2',
        receiptHandle: 'receipt2',
        body: 'test2',
        attributes: {} as SQSRecordAttributes,
        messageAttributes: {},
        md5OfBody: '',
        eventSource: '',
        eventSourceARN: '',
        awsRegion: '',
      }
    ];

    await deleteMessages(realSqsClient, queueUrl, records);

    // Verify DeleteMessage was called for each message
    expect(sqsMock.calls()).toHaveLength(2);

    // Verify the parameters of each call
    const calls = sqsMock.calls();
    expect(calls[0].args[0].input).toEqual({
      QueueUrl: queueUrl,
      ReceiptHandle: 'receipt1'
    });
    expect(calls[1].args[0].input).toEqual({
      QueueUrl: queueUrl,
      ReceiptHandle: 'receipt2'
    });
  });

  it('should handle empty records array', async () => {
    await deleteMessages(realSqsClient, queueUrl, []);
    expect(sqsMock.calls()).toHaveLength(0);
  });

  it('should throw error when deletion fails', async () => {
    sqsMock.on(DeleteMessageCommand).rejects(
      new Error('Failed to delete message')
    );

    const records: SQSRecord[] = [{
      messageId: '1',
      receiptHandle: 'receipt1',
      body: 'test1',
      attributes: {} as SQSRecordAttributes,
      messageAttributes: {},
      md5OfBody: '',
      eventSource: '',
      eventSourceARN: '',
      awsRegion: '',
    }];

    await expect(deleteMessages(realSqsClient, queueUrl, records))
      .rejects
      .toThrow('Failed to delete message');
  });

  it('should continue deleting other messages if one fails', async () => {
    sqsMock
      .on(DeleteMessageCommand)
      .rejectsOnce(new Error('Failed to delete first message'))
      .resolvesOnce({});

    const records: SQSRecord[] = [
      {
        messageId: '1',
        receiptHandle: 'receipt1',
        body: 'test1',
        attributes: {} as SQSRecordAttributes,
        messageAttributes: {},
        md5OfBody: '',
        eventSource: '',
        eventSourceARN: '',
        awsRegion: '',
      },
      {
        messageId: '2',
        receiptHandle: 'receipt2',
        body: 'test2',
        attributes: {} as SQSRecordAttributes,
        messageAttributes: {},
        md5OfBody: '',
        eventSource: '',
        eventSourceARN: '',
        awsRegion: '',
      }
    ];

    await expect(deleteMessages(realSqsClient, queueUrl, records))
      .rejects
      .toThrow('Failed to delete first message');

    // Verify both delete attempts were made
    expect(sqsMock.calls()).toHaveLength(2);
  });

  afterAll(() => {
    // Clean up
    realSqsClient.destroy();
  });
});
