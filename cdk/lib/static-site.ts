import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class StaticSiteStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    console.log('Starting stack deployment...');

    // Log the dist folder path
    const distPath = path.resolve(__dirname, '../../dist');
    console.log('Dist folder path:', distPath);

    // Create S3 bucket
    console.log('Creating S3 bucket...');
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      websiteIndexDocument: 'index.html',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    console.log('Bucket created with name:', siteBucket.bucketName);

    // Create CloudFront OAI
    console.log('Creating CloudFront OAI...');
    const cloudfrontOAI = new cloudfront.OriginAccessIdentity(this, 'CloudFrontOAI');

    // Grant permissions
    console.log('Granting S3 permissions...');
    siteBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [siteBucket.arnForObjects('*')],
        principals: [cloudfrontOAI.grantPrincipal],
      })
    );

    // Create CloudFront distribution
    console.log('Creating CloudFront distribution...');
    const distribution = new cloudfront.CloudFrontWebDistribution(this, 'MyDistribution', {
      originConfigs: [
        {
          s3OriginSource: {
            s3BucketSource: siteBucket,
            originAccessIdentity: cloudfrontOAI,
          },
          behaviors: [{ isDefaultBehavior: true }],
        },
      ],
      errorConfigurations: [
        {
          errorCode: 403,
          responsePagePath: '/index.html',
          responseCode: 200,
          errorCachingMinTtl: 10,
        },
        {
          errorCode: 404,
          responsePagePath: '/index.html',
          responseCode: 200,
          errorCachingMinTtl: 10,
        },
      ],
    });

    // Deploy site contents
    console.log('Deploying site contents...');
    new s3deploy.BucketDeployment(this, 'SiteDeployment', {
      sources: [s3deploy.Source.asset(distPath)],
      destinationBucket: siteBucket,
      distribution,
      distributionPaths: ['/*'],
    });

    // Output CloudFront URL
    new cdk.CfnOutput(this, 'CloudFrontURL', {
      value: distribution.distributionDomainName,
      exportName: 'CloudFrontDomainName',
    });

    console.log('Stack configuration complete');
  }
}
