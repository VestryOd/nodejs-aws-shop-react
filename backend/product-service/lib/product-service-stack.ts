import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cr from 'aws-cdk-lib/custom-resources';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

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

    // Grant permissions
    // Read permissions
    productsTable.grantReadData(getProductsList);
    stocksTable.grantReadData(getProductsList);

    productsTable.grantReadData(getProductById);
    stocksTable.grantReadData(getProductById);

    // Write permissions
    productsTable.grantWriteData(fillTablesLambda);
    stocksTable.grantWriteData(fillTablesLambda);


    // Read-Write permissions
    productsTable.grantReadWriteData(createProduct);
    stocksTable.grantReadWriteData(createProduct);

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
