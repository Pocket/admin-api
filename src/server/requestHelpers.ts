import { GraphQLRequest } from 'apollo-server-types';
import { IContext } from './context';
import { PocketUser } from '../jwtUtils';

/**
 * Extract first value from an http header. If array, first
 * element in array. If string, the string.
 */
export function extractHeader(header: string | string[]): string {
  if (header instanceof Array) {
    return header[0];
  } else {
    return header;
  }
}

/**
 * Copy the record values to the passed request object.
 * Mutates the request object inplace.
 */
export function addRecordToRequestHeader(
  record: Record<string, string>,
  request: GraphQLRequest
): void {
  Object.entries(record).forEach(([key, value]) => {
    request.http.headers.set(key, value);
  });
}

/**
 * Add pocket user properties to request header
 * The data added here are extracted from the JWT header
 * coming from the web repo
 * @param request
 * @param user
 */
export function buildRequestHeadersFromPocketUser(
  request: GraphQLRequest,
  user: PocketUser
): GraphQLRequest {
  for (const property in user) {
    if (user.hasOwnProperty(property)) {
      request.http.headers.set(property, user[property]);
    }
  }

  return request;
}

/**
 * These are additional request headers sent from the web repo.
 * Subgraphs use these headers coming for the original user
 * request to send accurate request context for analytics.
 * TODO: This will no longer be need once clients are able to make
 * requests directly to this gateway service.
 * @param request
 * @param webRequest
 */
export function buildRequestHeadersFromWebRequest(
  request: GraphQLRequest,
  webRequest: IContext['webRequest']
): GraphQLRequest {
  request.http.headers.set('gatewayLanguage', webRequest.language);
  request.http.headers.set('gatewayIpAddress', webRequest.ipAddress);
  request.http.headers.set(
    'gatewaySnowplowDomainUserId',
    webRequest.snowplowDomainUserId
  );
  request.http.headers.set('gatewayUserAgent', webRequest.userAgent);

  return request;
}
