// src/__tests__/importFileParser.test.ts
import { handler } from '../functions/importFileParser';
import { mockS3Event, mockCsvData } from './test-utils';
import { S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { sdkStreamMixin } from '@aws-sdk/util-stream-node';

// Mock the S3Client
jest.mock('@aws-sdk/client-s3', () => {
  const mockS3Client = {
    send: jest.fn()
  };
  return {
    S3Client: jest.fn(() => mockS3Client),
    GetObjectCommand: jest.fn(),
    CopyObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn()
  };
});

describe('importFileParser Lambda', () => {
  let mockS3Client: any;

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Get the mocked S3 client instance
    mockS3Client = new S3Client({});
  });

  it('should process CSV file and move it to parsed folder', async () => {
    // Create a readable stream with SDK mixin
    const stream = Readable.from([mockCsvData]);
    const sdkStream = sdkStreamMixin(stream);

    // Mock the S3 client send method for getObject
    mockS3Client.send.mockImplementationOnce(() => Promise.resolve({
      Body: sdkStream,
      $metadata: { httpStatusCode: 200 }
    }));

    // Mock successful copy
    mockS3Client.send.mockImplementationOnce(() => Promise.resolve({
      $metadata: { httpStatusCode: 200 }
    }));

    // Mock successful delete
    mockS3Client.send.mockImplementationOnce(() => Promise.resolve({
      $metadata: { httpStatusCode: 200 }
    }));

    const response = await handler(mockS3Event);

    // Verify the response
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      message: 'Successfully processed files'
    });

    // Verify S3 operations were called
    expect(mockS3Client.send).toHaveBeenCalledTimes(3);
  });

  it('should handle errors when processing file', async () => {
    mockS3Client.send.mockRejectedValueOnce(new Error('S3 error'));

    await expect(handler(mockS3Event)).rejects.toThrow('S3 error');
  });

  it('should handle empty S3 response', async () => {
    mockS3Client.send.mockResolvedValueOnce({
      $metadata: { httpStatusCode: 200 }
    });

    await expect(handler(mockS3Event)).rejects.toThrow('No body in S3 response');
  });
});
