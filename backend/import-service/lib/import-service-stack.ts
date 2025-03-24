import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3n from 'aws-cdk-lib/aws-s3-notifications';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

export class ImportServiceStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const basicAuthorizerLambdaArn = cdk.Fn.importValue('BasicAuthorizerFunctionArn');

    // Get reference to the authorizer lambda using cross-stack reference
    const authorizerFn = lambda.Function.fromFunctionArn(
      this,
      'BasicAuthorizerFunction',
      basicAuthorizerLambdaArn
    );

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
        CLOUDFRONT_URL: 'https://d35r08qiuo8xad.cloudfront.net/',
      },
      initialPolicy: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'lambda:InvokeFunction',
            'logs:CreateLogGroup',
            'logs:CreateLogStream',
            'logs:PutLogEvents'
          ],
          resources: ['*']
        }),
      ]
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

    const corsOptions = {
      allowOrigins: apigateway.Cors.ALL_ORIGINS,
      allowMethods: apigateway.Cors.ALL_METHODS,
      allowHeaders: [
        'Content-Type',
        'X-Amz-Date',
        'Authorization',
        'X-Api-Key',
        'X-Amz-Security-Token',
      ],
      allowCredentials: true
    };

    // api
    const api = new apigateway.RestApi(this, 'ImportApi', {
      restApiName: 'Import Service API',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: corsOptions,
    });

    logger.info('CORS configuration', { corsOptions });

    // Log what we can access from the API
    logger.info('API Gateway configuration', {
      restApiId: api.restApiId,
      url: api.url,
      rootResourceId: api.root.resourceId
    });

    const authorizer = new cdk.aws_apigateway.CfnAuthorizer(this, 'BasicAuthorizer', {
      restApiId: api.restApiId,
      name: 'BasicAuthorizer',
      type: 'TOKEN',
      identitySource: 'method.request.header.Authorization',
      authorizerUri: `arn:aws:apigateway:${this.region}:lambda:path/2015-03-31/functions/${authorizerFn.functionArn}/invocations`,
      authorizerResultTtlInSeconds: 0,
      identityValidationExpression: '^(?:Basic) [-0-9a-zA-Z._~+/]+=*$',
    });

    const importResource = api.root.addResource('import');

    importResource.addMethod('GET',
      new apigateway.LambdaIntegration(importProductsFile),
      {
        authorizer: {
          authorizerId: authorizer.ref
        },
        authorizationType: apigateway.AuthorizationType.CUSTOM
      }
    );

    api.addGatewayResponse('Unauthorized', {
      type: apigateway.ResponseType.UNAUTHORIZED,
      statusCode: '401',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
      templates: {
        'application/json': '{"message": "Unauthorized", "statusCode": 401}'
      }
    });

    api.addGatewayResponse('Forbidden', {
      type: apigateway.ResponseType.ACCESS_DENIED,
      statusCode: '403',
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
      templates: {
        'application/json': '{"message": "Forbidden", "statusCode": 403}'
      }
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
