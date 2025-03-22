import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

export class ProductServiceStack extends cdk.Stack {
  public readonly apiUrl: string;
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create Products table
    const productsTable = new dynamodb.Table(this, 'ProductsTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Cheapest option for low traffic
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development only
    });

    // Create Stocks table
    const stocksTable = new dynamodb.Table(this, 'StocksTable', {
      partitionKey: { name: 'product_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Create SQS Queue
    const catalogItemsQueue = new sqs.Queue(this, 'CatalogItemsQueue', {
      queueName: 'catalogItemsQueue',
      visibilityTimeout: cdk.Duration.seconds(30), // Should be at least 6x the function timeout
    });

    // Create SNS Topic
    const createProductTopic = new sns.Topic(this, 'CreateProductTopic', {
      topicName: 'createProductTopic',
    });

    // Get emails from environment variables
    const subscriptionEmail = process.env.SUBSCRIPTION_EMAIL;
    const filterEmail = process.env.FILTER_EMAIL;

    if (!subscriptionEmail || !filterEmail) {
      throw new Error('SUBSCRIPTION_EMAIL and FILTER_EMAIL environment variables are required');
    }

    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription(subscriptionEmail)
    );

    // Add filtered subscription (receives only expensive products)
    createProductTopic.addSubscription(
      new subscriptions.EmailSubscription(filterEmail, {
        filterPolicy: {
          price: sns.SubscriptionFilter.numericFilter({
            greaterThan: 50,  // Will only receive notifications for products with price > 50
          }),
        },
      })
    );

    // Create the Lambda function using NodejsFunction
    const catalogBatchProcess = new NodejsFunction(this, 'CatalogBatchProcess', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/functions/catalogBatchProcess/index.ts'),
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
        SNS_TOPIC_ARN: createProductTopic.topicArn,
        SQS_QUEUE_URL: catalogItemsQueue.queueUrl,
      },
      bundling: {
        externalModules: [
          'aws-sdk', // Exclude aws-sdk as it's available in the Lambda runtime
        ],
      },
    });

    // Create script for filling tables
    const fillTablesLambda = new NodejsFunction(this, 'FillTablesFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/functions/fillTables/index.ts'),
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020',
      },
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
    });

    const createProduct = new NodejsFunction(this, 'CreateProduct', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/functions/createProduct/index.ts'),
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020',
      },
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    const getProductsList = new NodejsFunction(this, 'GetProductsList', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/functions/getProductsList/index.ts'),
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020',
      },
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    const getProductById = new NodejsFunction(this, 'GetProductById', {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../src/functions/getProductById/index.ts'),
      handler: 'handler',
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'es2020',
      },
      environment: {
        PRODUCTS_TABLE: productsTable.tableName,
        STOCKS_TABLE: stocksTable.tableName,
      },
      logRetention: cdk.aws_logs.RetentionDays.ONE_WEEK,
    });

    catalogBatchProcess.addEventSource(new lambdaEventSources.SqsEventSource(catalogItemsQueue, {
      batchSize: 5,
    }));

    // Add permissions to the Lambda function's role
    catalogBatchProcess.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'dynamodb:BatchWriteItem',
          'dynamodb:PutItem',
          'dynamodb:GetItem',
          'dynamodb:Query',
          'dynamodb:Scan'
        ],
        resources: [
          productsTable.tableArn,
          stocksTable.tableArn
        ]
      })
    );

    // Grant permissions
    // Read permissions
    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductById);
    stocksTable.grantReadData(getProductById);

    // Write permissions
    productsTable.grantWriteData(fillTablesLambda);
    stocksTable.grantWriteData(fillTablesLambda);
    productsTable.grantWriteData(catalogBatchProcess);

    // Read-Write permissions
    productsTable.grantReadWriteData(createProduct);
    stocksTable.grantReadWriteData(createProduct);

    // Grant SNS publish permissions to the Lambda
    createProductTopic.grantPublish(catalogBatchProcess);

    // Create API Gateway
    const api = new apigateway.RestApi(this, 'ProductsApi', {
      restApiName: 'Products Service',
      deployOptions: {
        stageName: 'dev',
      },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type'],
        allowCredentials: false
      },
      defaultMethodOptions: {
        methodResponses: [{
          statusCode: '200',
        }, {
          statusCode: '400',
        }, {
          statusCode: '500',
        }]
      }
    });

    // Create resources and methods
    const products = api.root.addResource('products');
    products.addMethod('GET', new apigateway.LambdaIntegration(getProductsList));
    products.addMethod('POST', new apigateway.LambdaIntegration(createProduct));

    const product = products.addResource('{productId}');
    product.addMethod('GET', new apigateway.LambdaIntegration(getProductById));

    console.log('Infrastructure finished');

    new cr.AwsCustomResource(this, 'FillTablesCustomResource', {
      onCreate: {
        service: 'Lambda',
        action: 'invoke',
        parameters: {
          FunctionName: fillTablesLambda.functionName,
          InvocationType: 'RequestResponse'
        },
        physicalResourceId: cr.PhysicalResourceId.of('FillTablesCustomResource')
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new iam.PolicyStatement({
          actions: ['lambda:InvokeFunction'],
          effect: iam.Effect.ALLOW,
          resources: [fillTablesLambda.functionArn]
        })
      ])
    });

    // Export the URL
    this.apiUrl = api.url;

    // Console API params
    new cdk.CfnOutput(this, 'API URL', { value: api.url });
    new cdk.CfnOutput(this, 'API Gateway ID', { value: api.restApiId });
    new cdk.CfnOutput(this, 'API Gateway Stage', { value: api.deploymentStage.stageName });

    // Tags
    cdk.Tags.of(this).add('Environment', 'dev');
    cdk.Tags.of(this).add('Project', 'product-service');
  }
}
