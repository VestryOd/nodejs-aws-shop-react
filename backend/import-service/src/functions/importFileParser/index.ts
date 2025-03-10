
import { S3Event } from 'aws-lambda';
import { S3Client, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const BUCKET_NAME = process.env.BUCKET_NAME;
const PARSED_FOLDER = process.env.PARSED_FOLDER;

const s3Client = new S3Client({});

export const handler = async (event: S3Event) => {
  try {
    console.log('--event trigger', event);

    for (const record of event.Records) {
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, ' '));

      console.log(`Processing file: ${key} from bucket: ${BUCKET_NAME}`);

      const getObjectCommand = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key
      });

      const response = await s3Client.send(getObjectCommand);

      if (!response.Body) {
        throw new Error('No body in S3 response');
      }

      const results: any[] = [];
      await new Promise((resolve, reject) => {
        if (response.Body instanceof Readable) {
          response.Body
            .pipe(csvParser())
            .on('data', (data) => {
              console.log('Parsed CSV row:', JSON.stringify(data));
              results.push(data);
            })
            .on('error', (error) => {
              console.error('Error parsing CSV:', error);
              reject(error);
            })
            .on('end', async () => {
              try {
                const fileName = key.split('/').pop();
                const newKey = `${PARSED_FOLDER}/${fileName}`;

                const copyCommand = new CopyObjectCommand({
                  Bucket: BUCKET_NAME,
                  CopySource: `${BUCKET_NAME}/${key}`,
                  Key: newKey
                });
                await s3Client.send(copyCommand);

                const deleteCommand = new DeleteObjectCommand({
                  Bucket: BUCKET_NAME,
                  Key: key
                });
                await s3Client.send(deleteCommand);

                console.log(`Successfully moved file from ${key} to ${newKey}`);
                resolve(results);
              } catch (error) {
                reject(error);
              }
            });
        } else {
          reject(new Error('Invalid S3 response body type'));
        }
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully processed files' })
    };
  } catch (error) {
    console.error('Error in lambda handler:', error);
    throw error;
  }
};
