import { APIGatewayProxyEvent, S3Event } from 'aws-lambda';

export const mockS3Event: S3Event = {
  Records: [{
    eventVersion: '2.0',
    eventSource: 'aws:s3',
    awsRegion: 'us-east-1',
    eventTime: '1970-01-01T00:00:00.000Z',
    eventName: 'ObjectCreated:Put',
    userIdentity: {
      principalId: 'EXAMPLE'
    },
    requestParameters: {
      sourceIPAddress: '127.0.0.1'
    },
    responseElements: {
      'x-amz-request-id': 'EXAMPLE123456789',
      'x-amz-id-2': 'EXAMPLE123/5678abcdefghijklambdaisawesome/mnopqrstuvwxyzABCDEFGH'
    },
    s3: {
      s3SchemaVersion: '1.0',
      configurationId: 'testConfigRule',
      bucket: {
        name: process.env.BUCKET_NAME || 'test-bucket',
        ownerIdentity: {
          principalId: 'EXAMPLE'
        },
        arn: `arn:aws:s3:::${process.env.BUCKET_NAME || 'test-bucket'}`
      },
      object: {
        key: 'uploaded/test.csv',
        size: 1024,
        eTag: '0123456789abcdef0123456789abcdef',
        sequencer: '0A1B2C3D4E5F678901'
      }
    }
  }]
};

export const mockApiGatewayEvent: APIGatewayProxyEvent = {
  body: null,
  headers: {},
  multiValueHeaders: {},
  httpMethod: 'GET',
  isBase64Encoded: false,
  path: '/import',
  pathParameters: null,
  queryStringParameters: {
    name: 'test.csv'
  },
  multiValueQueryStringParameters: null,
  stageVariables: null,
  requestContext: {
    accountId: '123456789012',
    apiId: 'api-id',
    authorizer: null,
    protocol: 'HTTP/1.1',
    httpMethod: 'GET',
    identity: {
      accessKey: null,
      accountId: null,
      apiKey: null,
      apiKeyId: null,
      caller: null,
      clientCert: null,
      cognitoAuthenticationProvider: null,
      cognitoAuthenticationType: null,
      cognitoIdentityId: null,
      cognitoIdentityPoolId: null,
      principalOrgId: null,
      sourceIp: '127.0.0.1',
      user: null,
      userAgent: null,
      userArn: null,
    },
    path: '/import',
    stage: 'dev',
    requestId: 'request-id',
    requestTimeEpoch: 1234567890,
    resourceId: 'resource-id',
    resourcePath: '/import',
  },
  resource: '/import'
};

export const mockApiGatewayEventWithoutFileName: APIGatewayProxyEvent = {
  ...mockApiGatewayEvent,
  queryStringParameters: null
};

export const mockCsvData = `id,title,description,price,count
7567ec4b-b10c-48c5-9345-fc73c48a80aa,Product One,Short Product Description 1,24,1
7567ec4b-b10c-48c5-9345-fc73c48a80ab,Product Two,Short Product Description 2,15,2`;
