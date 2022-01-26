import { GatewayConfig } from '@apollo/gateway';
import { GraphQLRequest } from 'apollo-server-types';
import { ApolloGateway, RemoteGraphQLDataSource } from '@apollo/gateway';
import config from './../config';
import { IContext } from './context';
import {
  buildRequestHeadersFromPocketUser,
  buildRequestHeadersFromWebRequest,
  addRecordToRequestHeader,
} from './requestHelpers';
import { readFileSync } from 'fs';

let options: GatewayConfig = {
  buildService({ url }) {
    return new RemoteGraphQLDataSource({
      url,
      willSendRequest({
        request,
        context,
      }: {
        request: GraphQLRequest;
        context: IContext;
      }) {
        const { token, pocketUser, webRequest, forwardHeaders } = context;
        // Pass along any headers that should be forwarded to the subgraphs
        addRecordToRequestHeader(forwardHeaders, request);

        // Pass through the jwt token if a token exists to each subgraph
        if (token) {
          request.http.headers.set('jwt', token);
        }

        if (pocketUser) {
          // We have a decoded JWT at context.pocketUser.. Let's pass down the individual properties as headers.
          // OPEN_QUESTION: is this secure? should downstream have to verify their JWT?
          // All subgraph are currently in a VPC so we can trust the headers that are sent down by the gateway
          buildRequestHeadersFromPocketUser(request, pocketUser);
        }

        if (webRequest) {
          buildRequestHeadersFromWebRequest(request, webRequest);
        }
      },
    });
  },
};

if (config.isDev) {
  options = {
    ...options,
    //If we are development lets compile the schema locally and not hit apollo engine.
    // Update the yaml file ./local-supergraph-config for locally running services
    // See https://www.apollographql.com/docs/federation/quickstart/
    supergraphSdl: readFileSync('./local-supergraph.graphql').toString(),
  } as GatewayConfig;
}

// Initialize an ApolloGateway instance and pass it an array of
// your implementing service names and URLs
export const getAppGateway = (): ApolloGateway => new ApolloGateway(options);
