const name = 'AdminAPI';
const domainPrefix = 'admin-api';
const isDev = process.env.NODE_ENV === 'development';
const environment = isDev ? 'Dev' : 'Prod';
const domain = isDev
  ? `${domainPrefix}.getpocket.dev`
  : `${domainPrefix}.getpocket.com`;
const graphqlVariant = isDev ? 'development' : 'current';
const githubConnectionArn = isDev
  ? 'arn:aws:codestar-connections:us-east-1:410318598490:connection/7426c139-1aa0-49e2-aabc-5aef11092032'
  : 'arn:aws:codestar-connections:us-east-1:996905175585:connection/5fa5aa2b-a2d2-43e3-ab5a-72ececfc1870';
const branch = isDev ? 'dev' : 'main';
const isProd = process.env.NODE_ENV === 'production';

//Arbitrary size and count for cache. No logic was used in deciding this.
/*
  relevant AWS doc: https://docs.aws.amazon.com/AmazonElastiCache/latest/mem-ug/nodes-select-size.html#CacheNodes.SelectSize

  sounds like we need the following to make an educated guess:

  the total cache needed (in GB)
  the amount of failure in cache size we can tolerate without severely impacting db performance (in the event one node goes down)

  once we know that, we can tweak based on necessary CPU performance (which we can get through cloudwatch metrics).

  current config (2 nodes at cache.t3.medium) = 6gb of memory and 4 cpus
*/
const cacheNodes = isDev ? 2 : 2;
const cacheSize = isDev ? 'cache.t2.micro' : 'cache.t3.medium';

export const config = {
  name,
  isProd,
  prefix: `${name}-${environment}`,
  circleCIPrefix: `/${name}/CircleCI/${environment}`,
  shortName: 'AAPI',
  environment,
  domain,
  cacheNodes,
  cacheSize,
  isDev,
  codePipeline: {
    githubConnectionArn,
    repository: 'pocket/admin-api',
    branch,
  },
  tags: {
    service: name,
    environment,
  },
  healthCheck: {
    command: [
      'CMD-SHELL',
      'curl -f http://localhost:4027/.well-known/apollo/server-health || exit 1',
    ],
    interval: 15,
    retries: 3,
    timeout: 5,
    startPeriod: 0,
  },
  envVars: {
    graph: {
      graphId: 'pocket-admin-api',
      graphVariant: graphqlVariant,
    },
  },
};
