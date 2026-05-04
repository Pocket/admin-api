import * as Sentry from '@sentry/node';

import {
  AdminAPIUser,
  getSigningKeysFromServer,
  validateAndGetAdminAPIUser,
} from '../jwtUtils';
import { extractHeader } from './requestHelpers';

export type IContext = {
  publicKeys?: Record<string, string>;
  token?: string;
  adminAPIUser?: AdminAPIUser;
  forwardHeaders?: {
    'origin-client-ip': string;
    'apollo-require-preflight': string;
  };
};

export async function getAppContext(
  { req },
  publicKeys: Record<string, string>,
): Promise<IContext> {
  // See if we have an authorization header
  const token = req.headers.authorization ?? null;

  // if the request doesn't have a JWT, reject it outright
  if (!token) {
    // log to ECS
    console.log('Request is missing JWT');
    console.log(req);

    Sentry.captureException('Request is missing JWT');

    // throw a generic error if request is missing JWT
    throw new Error('Internal server error');
  }

  const context: IContext = { token, publicKeys };

  // OH boy! we have an authorization header, lets pull out our JWT and validate it.
  context.token = token.split(' ')[1];

  // AHH we have a user. Lets put it in our request to use elsewhere.
  // this will throw if the provided JWT is invalid.
  context.adminAPIUser = await validateAndGetAdminAPIUser(
    context.token,
    publicKeys,
  );

  // Add the request headers we want to forward to the subgraphs
  context.forwardHeaders = {
    // We want the originating client, which is the leftmost IP address
    // if x-forwarded-for is an array
    'origin-client-ip': extractHeader(req.headers['x-forwarded-for']),
    'apollo-require-preflight': extractHeader(
      req.headers['apollo-require-preflight'],
    ),
  };

  return context;
}

// Lazy load the public key and save in memory for subsequent request contexts
let publicKeys: Record<string, string>;

async function getSigningKeys() {
  if (!publicKeys) {
    publicKeys = await getSigningKeysFromServer();
  }

  return publicKeys;
}

// Inject public key into the context creator function
export const contextFactory = async ({ req }): Promise<IContext> => {
  const pKeys = await getSigningKeys();
  return getAppContext({ req }, pKeys);
};
