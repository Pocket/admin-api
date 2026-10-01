import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express4';
import { ApolloServerPluginCacheControl } from '@apollo/server/plugin/cacheControl';
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import cors from 'cors';
import config from '../config';
import AWSXRay from 'aws-xray-sdk-core';
import xrayExpress from 'aws-xray-sdk-express';
import express from 'express';
import https from 'https';
import { contextFactory, IContext } from './context';
import { getAppGateway } from './gateway';
import * as Sentry from '@sentry/node';
import { sentryPlugin } from './sentryPlugin';
import graphqlUploadExpress from 'graphql-upload/graphqlUploadExpress.js';

// 2026-05-04: Set XRAY to ignore context missing errors
// AWS logs are flooded with context missing errors, making it difficult to
// debug other issues.
AWSXRay.setContextMissingStrategy('IGNORE_ERROR');

//Add the AWS XRAY ECS plugin that will add ecs specific data to the trace
AWSXRay.config([AWSXRay.plugins.ECSPlugin]);

//Capture all https traffic this service sends
//This is to auto capture node fetch requests (like to parser)
//The second parameter is to enable downstream xray calls
AWSXRay.captureHTTPsGlobal(https, true);

//Capture all promises that we make
AWSXRay.capturePromise();

Sentry.init({
  ...config.sentry,
  debug: config.sentry.environment == 'development',
});

async function startServer() {
  const server = new ApolloServer<IContext>({
    gateway: getAppGateway(),
    includeStacktraceInErrorResponses: process.env.NODE_ENV !== 'production',
    // Enable schema introspection so that GraphQL Codegen can generate types
    // that are used by Apollo Client in frontend apps
    introspection: true,
    plugins: [
      sentryPlugin,
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageLocalDefault({ footer: false }),
      // Set a default cache control of 5 seconds so it will send cache headers.
      // Individual schemas can define headers on directives that the Gateway will then merge
      ApolloServerPluginCacheControl({
        defaultMaxAge: config.apollo.defaultMaxAge,
      }),
    ],
  });

  await server.start();

  return server;
}

const server = startServer();
// Pass the ApolloGateway to the ApolloServer constructor

const app = express();

// enable file uploads!
app.use(
  graphqlUploadExpress({
    maxFileSize: config.app.upload.maxSize,
    maxFiles: config.app.upload.maxFiles,
  }),
);

//If there is no host header (really there always should be..) then use admin-api as the name
app.use(xrayExpress.openSegment('admin-api'));

//Set XRay to use the host header to open its segment name.
AWSXRay.middleware.enableDynamicNaming('*');

// Health check used by ECS and the ALB (built into Apollo Server 3)
app.get('/.well-known/apollo/server-health', (req, res) => {
  res.type('application/health+json').json({ status: 'pass' });
});

//Apply the GraphQL middleware into the express app. cors() and express.json()
//match what Apollo Server 3's applyMiddleware set up.
const graphqlMiddleware = server.then((server) =>
  expressMiddleware(server, { context: contextFactory }),
);
app.use('/', cors(), express.json(), (req, res, next) => {
  graphqlMiddleware.then((middleware) => middleware(req, res, next), next);
});

//Make sure the express app has the xray close segment handler
app.use(xrayExpress.closeSegment());

export default app;
