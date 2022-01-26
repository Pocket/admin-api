import {
  getSigningKeysFromServer,
  PocketUser,
  validateAndGetPocketUser,
} from '../jwtUtils';
import { extractHeader } from './requestHelpers';
export type IContext = {
  publicKeys?: Record<string, string>;
  token?: string;
  pocketUser?: PocketUser;
  webRequest?: {
    language?: string;
    ipAddress?: string;
    snowplowDomainUserId?: string;
    userAgent?: string;
  };
  forwardHeaders?: {
    'origin-client-ip': string;
  };
};

export async function getAppContext(
  { req },
  publicKeys: Record<string, string>
): Promise<IContext> {
  //See if we have an authorization header
  const token = req.headers.authorization ?? null;

  const context: IContext = { token: token, publicKeys: publicKeys };

  //OH boy! we have an authorization header, lets pull out our JWT and validate it.
  if (token) {
    context.token = token.split(' ')[1];
    //AHH we have a user. Lets put it in our request to use elsewhere.
    context.pocketUser = await validateAndGetPocketUser(
      context.token,
      publicKeys
    );
  }
  // Add the request headers we want to forward to the subgraphs
  context.forwardHeaders = {
    // We want the originating client, which is the leftmost IP address
    // if x-forwarded-for is an array
    'origin-client-ip': extractHeader(req.headers['x-forwarded-for']),
  };

  // let's add web repo request headers to the context
  context.webRequest = {
    userAgent: req.headers['web-request-user-agent'] as string,
    ipAddress: req.headers['web-request-ip-address'] as string,
    snowplowDomainUserId: req.headers[
      'web-request-snowplow-domain-user-id'
    ] as string,
    language: req.headers['web-request-language'] as string,
  };

  return context;
}

// Lazy load the public key and save in memory for subsequent request contexts
let publicKeys: Record<string, string>;

async function getSigningKeys() {
  if (publicKeys) return publicKeys;
  publicKeys = await getSigningKeysFromServer();
  return publicKeys;
}

// Inject public key into the context creator function
export const contextFactory = async ({ req }): Promise<IContext> => {
  const pKeys = await getSigningKeys();
  return getAppContext({ req }, pKeys);
};
