import { ApolloServer } from 'apollo-server-express';
import config, { memcached } from '../config';
import responseCachePlugin from 'apollo-server-plugin-response-cache';
import AWSXRay from 'aws-xray-sdk-core';
import xrayExpress from 'aws-xray-sdk-express';
import express from 'express';
import https from 'https';
import { contextFactory } from './context';
import { getAppGateway } from './gateway';
import * as Sentry from '@sentry/node';
import { errorHandler } from '@pocket-tools/apollo-utils';
import {
  ApolloServerPluginCacheControl,
  ApolloServerPluginLandingPageDisabled,
  ApolloServerPluginLandingPageGraphQLPlayground,
} from 'apollo-server-core';
import { sentryPlugin } from '@pocket-tools/apollo-utils';
import { GraphQLRequestContext } from 'apollo-server-plugin-base';

//Set XRAY to just log if the context is missing instead of a runtime error
AWSXRay.setContextMissingStrategy('LOG_ERROR');

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
  const server = new ApolloServer({
    gateway: getAppGateway(),
    debug: config.isDev,
    // Enable schema introspection so that GraphQL Codegen can generate types
    // that are used by Apollo Client in frontend apps
    introspection: true,
    // Caches the queries that apollo clients can send via a hashed get request
    // This allows us to cache resolver decisions
    persistedQueries: {
      cache: memcached,
      ttl: 300, // 5 minutes
    },
    //The cache that Apollo should use for all of its responses
    //https://www.apollographql.com/docs/apollo-server/data/data-sources/#using-memcachedredis-as-a-cache-storage-backend
    //This will only be used if all data in the response is cacheable
    //However because up above we set cacheControl to default of 5 this is always cached for at least 5 seconds
    //This will add the CDN cache control headers to the response and will cache it in memcached if its cacheable
    cache: memcached,
    context: contextFactory,
    plugins: [
      //Copied from Apollo docs, the sessionID signifies if we should separate out caches by user.
      responseCachePlugin({
        //https://www.apollographql.com/docs/apollo-server/performance/caching/#saving-full-responses-to-a-cache
        sessionId: (requestContext: GraphQLRequestContext) =>
          requestContext.context.pocketUser?.userId ?? null,
      }),
      sentryPlugin,
      process.env.NODE_ENV === 'production'
        ? ApolloServerPluginLandingPageDisabled()
        : ApolloServerPluginLandingPageGraphQLPlayground(),
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

//If there is no host header (really there always should be..) then use admin-api as the name
app.use(xrayExpress.openSegment('admin-api'));

//Set XRay to use the host header to open its segment name.
AWSXRay.middleware.enableDynamicNaming('*');

//Apply the GraphQL middleware into the express app
server.then((server) => server.applyMiddleware({ app, path: '/' }));

//Make sure the express app has the xray close segment handler
app.use(xrayExpress.closeSegment());

export default app;
