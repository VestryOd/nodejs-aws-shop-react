export const handler = async (event: any) => {
  console.log('Event: ', event);

  if (!event.headers?.Authorization) {
    return generatePolicy('user', 'Deny', event.methodArn, 401);
  }

  try {
    const authHeader = event.headers.Authorization;
    const encodedCreds = authHeader.split(' ')[1];
    const plainCreds = Buffer.from(encodedCreds, 'base64').toString().split(':');
    const username = plainCreds[0];
    const password = plainCreds[1];

    console.log(`username: ${username}, password: ${password}`);

    const isAuthorized =
      username === process.env.AUTH_LOGIN_NAME &&
      password === process.env.AUTH_PASSWORD;

    const effect = isAuthorized ? 'Allow' : 'Deny';
    const statusCode = isAuthorized ? 200 : 403;

    return generatePolicy(username, effect, event.methodArn, statusCode);
  } catch (error) {
    return generatePolicy('user', 'Deny', event.methodArn, 403);
  }
};

const generatePolicy = (principalId: string, effect: string, resource: string, statusCode: number) => {
  return {
    principalId,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
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
