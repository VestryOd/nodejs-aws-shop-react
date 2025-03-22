import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as dotenv from "dotenv";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as iam from "aws-cdk-lib/aws-iam";

dotenv.config({ path: path.join(__dirname, "../../../.env") });

export class AuthorizationServiceStack extends cdk.Stack {
  public readonly basicAuthorizerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.basicAuthorizerFunction = new NodejsFunction(
      this,
      "BasicAuthorizerFunction",
      {
        runtime: lambda.Runtime.NODEJS_18_X,
        handler: "handler",
        entry: path.join(
          __dirname,
          "../src/functions/basicAuthorizer/index.ts"
        ),
        bundling: {
          minify: true,
          sourceMap: true,
        },
        environment: {
          AUTH_LOGIN_NAME: process.env.AUTH_LOGIN_NAME || "",
          AUTH_PASSWORD: process.env.AUTH_PASSWORD || "",
        },
      }
    );

    this.basicAuthorizerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          "lambda:InvokeFunction",
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents",
        ],
        resources: ["*"],
      })
    );

    this.basicAuthorizerFunction.addPermission("ApiGatewayInvokeFunction", {
      principal: new iam.ServicePrincipal("apigateway.amazonaws.com"),
      sourceArn: `arn:aws:execute-api:${this.region}:${this.account}:*`,
    });

    // Export the function ARN
    new cdk.CfnOutput(this, "BasicAuthorizerFunctionArn", {
      value: this.basicAuthorizerFunction.functionArn,
      exportName: "BasicAuthorizerFunctionArn",
    });
  }
}
