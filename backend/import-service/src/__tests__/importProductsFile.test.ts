import { handler } from '../functions/importProductsFile';
import { mockApiGatewayEvent, mockApiGatewayEventWithoutFileName } from './test-utils';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('importProductsFile Lambda', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return signed URL when file name is provided', async () => {
    const mockSignedUrl = 'https://test-signed-url.com';
    (getSignedUrl as jest.Mock).mockResolvedValue(mockSignedUrl);

    const response = await handler(mockApiGatewayEvent);

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ signedUrl: mockSignedUrl });
    expect(getSignedUrl).toHaveBeenCalled();
  });

  it('should return 400 when file name is not provided', async () => {
    const response = await handler(mockApiGatewayEventWithoutFileName);

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual({ error: 'File name is required' });
  });

  it('should return 500 when signing URL fails', async () => {
    (getSignedUrl as jest.Mock).mockRejectedValue(new Error('Signing failed'));

    const response = await handler(mockApiGatewayEvent);

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({ error: 'Could not generate signed URL' });
  });
});

