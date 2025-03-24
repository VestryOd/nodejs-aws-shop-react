import {
  APIGatewayTokenAuthorizerEvent,
  APIGatewayAuthorizerResult,
} from "aws-lambda";
import { Effect } from "@aws-cdk/aws-iam";
import { Logger } from "@aws-lambda-powertools/logger";

const logger = new Logger();

export const handler = async (
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> => {
  logger.info("Event: ", JSON.stringify(event, null, 2));

  if (!event.authorizationToken) {
    logger.error("No authorization token found");
    return generatePolicy("user", Effect.DENY, event.methodArn, 401);
  }

  try {
    if (!event.authorizationToken.toLowerCase().startsWith("basic ")) {
      logger.error("Not a Basic auth token");
      return generatePolicy("user", Effect.DENY, event.methodArn, 401);
    }

    const encodedCreds = event.authorizationToken.split(" ")[1];
    const plainCreds = Buffer.from(encodedCreds, "base64")
      .toString()
      .split("=");
    const username = plainCreds[0];
    const password = plainCreds[1];

    logger.info(`Attempting authorization with creds: ${username}`);

    const isAuthorized =
      username === process.env.AUTH_LOGIN_NAME &&
      password === process.env.AUTH_PASSWORD;

    logger.info(`Authorization ${isAuthorized ? "successful" : "failed"}`);

    const effect = isAuthorized ? Effect.ALLOW : Effect.DENY;
    const statusCode = isAuthorized ? 200 : 403;
    logger.info(
      `Final result: isAuthorized - ${isAuthorized}, effect - ${effect}, statusCode - ${statusCode}`
    );

    return generatePolicy(username, effect, event.methodArn, statusCode);
  } catch (error: any) {
    logger.error("Error during authorization:", error);
    return generatePolicy("user", Effect.DENY, event.methodArn, 403);
  }
};

const generatePolicy = (
  principalId: string,
  effect: Effect,
  resource: string,
  statusCode: number
): APIGatewayAuthorizerResult => {
  return {
    principalId,
    policyDocument: {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    },
    context: {
      statusCode,
    },
  };
};
