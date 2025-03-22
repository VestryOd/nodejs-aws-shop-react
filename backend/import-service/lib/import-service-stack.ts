import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create S3 bucket
    const importBucket = new s3.Bucket(this, 'XXXXXXXXXXXX', {
      bucketName: `import-service-bucket-${this.account}`,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
          ],
          allowedOrigins: ['*'],
          allowedHeaders: ['*'],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
      autoDeleteObjects: true, // For development only
    });

    // Get reference to existing SQS queue
    const queueArn = `arn:aws:sqs:${this.region}:${this.account}:catalogItemsQueue`;
    const queueUrl = `https://sqs.${this.region}.amazonaws.com/${this.account}/catalogItemsQueue`;

    const catalogItemsQueue = sqs.Queue.fromQueueAttributes(this, 'ImportCatalogItemsQueue', {
      queueUrl,
      queueArn,
    });

    // Create Lambda function
    const importProductsFile = new NodejsFunction(this, 'ImportProductsFileLambda', {
      functionName: 'importProductsFile',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/importProductsFile/index.ts'),
      timeout: cdk.Duration.seconds(30),
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        UPLOAD_FOLDER: 'uploaded', // folder for uploaded files
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Create importFileParser Lambda
    const importFileParser = new NodejsFunction(this, 'ImportFileParserLambda', {
      functionName: 'importFileParser',
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/importFileParser/index.ts'),
      timeout: cdk.Duration.seconds(60),
      environment: {
        BUCKET_NAME: importBucket.bucketName,
        UPLOAD_FOLDER: 'uploaded',
        PARSED_FOLDER: 'parsed',
        SQS_URL: catalogItemsQueue.queueUrl,
        REGION: this.region,
      }
    });

    // Grant permissions
    importBucket.grantReadWrite(importProductsFile);
    importBucket.grantReadWrite(importFileParser);

    // Grant SQS permissions
    catalogItemsQueue.grantSendMessages(importFileParser);

    // Add S3 event notification for uploaded folder
    importBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(importFileParser),
      { prefix: 'uploaded/' } // Only trigger for objects in uploaded folder
    );

    // api
    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const importResource = api.root.addResource('import');
    importResource.addMethod('GET', new apigateway.LambdaIntegration(importProductsFile), {
      requestParameters: {
        'method.request.querystring.name': true,
      },
    });

    // Console API params
    new cdk.CfnOutput(this, 'API URL', { value: api.url });
    new cdk.CfnOutput(this, 'API Gateway ID', { value: api.restApiId });
    new cdk.CfnOutput(this, 'API Gateway Stage', { value: api.deploymentStage.stageName });

    // Tags
    cdk.Tags.of(this).add('Environment', 'dev');
    cdk.Tags.of(this).add('Project', 'import-service');
  }
}
