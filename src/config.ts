const config = {
  app: {
    upload: {
      maxSize: 10000000,
      maxFiles: 10,
    },
  },
  apollo: {
    graphVariant: process.env.GRAPHQL_VARIANT || 'development',
    defaultMaxAge: 0,
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
    release: process.env.GIT_SHA || '',
    environment: process.env.NODE_ENV || 'development',
  },
  auth: {
    mozillaAuthProxy: {
      jwtIssuer:
        // MOZILLA_AUTH_PROXY_JWT_ISSUER is not set in this repo (or anywhere?)
        process.env.MOZILLA_AUTH_PROXY_JWT_ISSUER ||
        'cognito-idp.us-east-1.amazonaws.com/us-east-1_qYkccPmmu',
      // MOZILLA_AUTH_PROXY_KIDS is not set in this repo (or anywhere?)
      kids: process.env.MOZILLA_AUTH_PROXY_KIDS?.split(',') || [
        'OR8erz5A8/hCkVdHczk879k2zUQXoAke9p8TQXsgKLQ=',
        'QtBbT/twDz6JmT99PQkAOB+QBhG4eJvxk8pOr7YzfWU=',
      ],
    },
    pocket: {
      // POCKET_JWT_ISSUER is not set in this repo (or anywhere?)
      jwtIssuer: process.env.POCKET_JWT_ISSUER || 'getpocket.com',
      kids:
        // POCKET_KIDS is not set in this repo (or anywhere?)
        process.env.POCKET_KIDS?.split(',') ||
        // if you add a new JWK to https://github.com/Pocket/dotcom-gateway/blob/main/static/.well-known/jwk
        // you must also specify it here for the environment you want
        process.env.NODE_ENV === 'production'
          ? ['CURMIG', 'CORPSL', 'SEMGRL', 'MLMFLO', 'PROTRL', 'HNTCPP']
          : ['CMGDEV', 'CORDEV', 'SMGRDV', 'MLMDEV', 'PTLDEV', 'HNTCPN'],
    },
    defaultKid:
      // DEFAULT_KID is not set in this repo (or anywhere?)
      process.env.DEFAULT_KID || 'OR8erz5A8/hCkVdHczk879k2zUQXoAke9p8TQXsgKLQ=',
  },
};

export default config;
