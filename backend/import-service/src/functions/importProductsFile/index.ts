import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const BUCKET_NAME = process.env.BUCKET_NAME;
const UPLOAD_FOLDER = process.env.UPLOAD_FOLDER;
const EXPIRES_IN = 3600; // URL expires in 1 hour

import { Logger } from "@aws-lambda-powertools/logger";
const logger = new Logger();

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
  "Content-Type": "application/json",
};

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL;

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  logger.info("Event received", { event });
  logger.info("Environment variables", {
    BUCKET_NAME,
    UPLOAD_FOLDER,
    CLOUDFRONT_URL,
    AWS_REGION: process.env.AWS_REGION,
  });

  const origin = event.headers?.origin || event.headers?.Origin;
  logger.info("Request details", { origin });

  logger.info("Response headers", { headers });

  try {
    const fileName = event.queryStringParameters?.name;
    logger.info("File name from query", { fileName });

    if (!fileName) {
      logger.warn("No filename provided");
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: "File name is required" }),
      };
    }

    const key = `${UPLOAD_FOLDER}/${fileName}`;
    logger.info("Generated S3 key", { key });

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: "text/csv",
    });
    logger.info("Created PutObjectCommand", {
      bucket: BUCKET_NAME,
      key,
      contentType: "text/csv",
    });

    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: EXPIRES_IN,
    });
    logger.info("Generated signed URL successfully");

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ signedUrl }),
    };
  } catch (error) {
    logger.error("Error in handler", {
      error: error as Error,
      errorMessage: (error as Error).message,
      errorStack: (error as Error).stack,
    });

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Could not generate signed URL",
        details: (error as Error).message,
      }),
    };
  }
};
