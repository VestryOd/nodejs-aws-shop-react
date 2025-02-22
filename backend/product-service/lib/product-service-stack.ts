import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';

export class ProductServiceStack extends cdk.Stack {
  public readonly apiUrl: string;
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create layers layer
    const sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
      code: lambda.Code.fromAsset(path.join(__dirname, '../dist/layers')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_18_X],
      description: 'Common utilities and mock data',
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
      layers: [sharedLayer],
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
      layers: [sharedLayer],
    });

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
    });

    // Export the URL
    this.apiUrl = api.url;

    // Create resources and methods
    const products = api.root.addResource('products');
    products.addMethod('GET', new apigateway.LambdaIntegration(getProductsList));

    const product = products.addResource('{productId}');
    product.addMethod('GET', new apigateway.LambdaIntegration(getProductById));

    console.log('Infrastructure finished');

    // Console API params
    new cdk.CfnOutput(this, 'API URL', { value: api.url });
    new cdk.CfnOutput(this, 'API Gateway ID', { value: api.restApiId });
    new cdk.CfnOutput(this, 'API Gateway Stage', { value: api.deploymentStage.stageName });
  }
}
