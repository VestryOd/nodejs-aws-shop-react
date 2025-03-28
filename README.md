# React-shop-cloudfront

This is frontend starter project for nodejs-aws mentoring program. It uses the following technologies:

- [Vite](https://vitejs.dev/) as a project bundler
- [React](https://beta.reactjs.org/) as a frontend framework
- [React-router-dom](https://reactrouterdotcom.fly.dev/) as a routing library
- [MUI](https://mui.com/) as a UI framework
- [React-query](https://react-query-v3.tanstack.com/) as a data fetching library
- [Formik](https://formik.org/) as a form library
- [Yup](https://github.com/jquense/yup) as a validation schema
- [Vitest](https://vitest.dev/) as a test runner
- [MSW](https://mswjs.io/) as an API mocking library
- [Eslint](https://eslint.org/) as a code linting tool
- [Prettier](https://prettier.io/) as a code formatting tool
- [TypeScript](https://www.typescriptlang.org/) as a type checking tool

## AWS Console
- S3 Bucket - http://vestry-aws-course-task2-manually.s3-website-us-east-1.amazonaws.com/

## CDK (task-2)
- CloudFront - https://d35r08qiuo8xad.cloudfront.net/
- S3 Bucket - https://staticsitestack-sitebucket397a1860-31ew02k9f6wp.s3.eu-west-1.amazonaws.com

## API Gateway & Lambdas (task-3)
- CloudFront - https://d35r08qiuo8xad.cloudfront.net/
- Products list (Lambda) - https://tsmdu35c4d.execute-api.eu-west-1.amazonaws.com/dev/products
- Product Item by id (lambda) - https://tsmdu35c4d.execute-api.eu-west-1.amazonaws.com/dev/products/7567ec4b-b10c-48c5-9345-fc73c48a80a1

## DynamoDB & Lambdas (task-4)
- CloudFront - https://d35r08qiuo8xad.cloudfront.net/
- Products list (Lambda) - https://tsmdu35c4d.execute-api.eu-west-1.amazonaws.com/dev/products
- Product Item by id (lambda) https://tsmdu35c4d.execute-api.eu-west-1.amazonaws.com/dev/products/7567ec4b-b10c-48c5-9345-fc73c48a80aa
- Creation a new products script example (script example below): 

**Request:**
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "title": "New Product",
       "description": "Product description",
       "price": 99.99,
       "count": 10
     }' \
     https://tsmdu35c4d.execute-api.eu-west-1.amazonaws.com/dev/products
```

**Success Response:**
```json
{
  "id": "7567ec4b-b10c-48c5-9345-fc73c48a80aa",
  "title": "New Product",
  "description": "Product description",
  "price": 99.99,
  "count": 10
}
```

## Available Scripts

### `start`

Starts the project in dev mode with mocked API on local environment.

### `build`

Builds the project for production in `dist` folder.

### `preview`

Starts the project in production mode on local environment.

### `test`, `test:ui`, `test:coverage`

Runs tests in console, in browser or with coverage.

### `lint`, `prettier`

Runs linting and formatting for all files in `src` folder.

### `deploy`

Deploys infrastructure to the aws via CDK

### `destroy`

Clear current stack
