#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AuthorizationServiceStack } from '../lib/authorization-service-stack';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

const app = new cdk.App();
new AuthorizationServiceStack(app, 'AuthorizationServiceStack', {
  env: {
    region: 'eu-west-1',
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
  description: 'Auth Service Backend Stack'
});

app.synth();