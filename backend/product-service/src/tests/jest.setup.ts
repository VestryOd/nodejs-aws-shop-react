// backend/product-service/src/tests/jest.setup.ts

process.env = {
  ...process.env,
  PRODUCTS_TABLE: 'test-products-table',
  STOCKS_TABLE: 'test-stocks-table',
  SNS_TOPIC_ARN: 'test-topic-arn',
  SQS_QUEUE_URL: 'test-sqs-arn'
};
