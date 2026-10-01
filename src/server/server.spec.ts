import { composeServices } from '@apollo/composition';
import { parse } from 'graphql';
import request from 'supertest';
import sinon from 'sinon';
import * as jwtUtils from '../jwtUtils';

// HTTP behavior that clients (curation admin tools, lambdas, the crawl
// pipeline) and the ECS/ALB health checks depend on.
describe('server', () => {
  let app;
  let validate: sinon.SinonStub;

  beforeAll(async () => {
    const { supergraphSdl, errors } = composeServices([
      {
        name: 'corpus',
        url: 'http://localhost:1/',
        typeDefs: parse(`
          extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])
          type Query { item(limit: Int!): Int }
        `),
      },
    ]);
    if (errors) throw errors[0];

    sinon.stub(jwtUtils, 'getSigningKeysFromServer').resolves({});
    validate = sinon.stub(jwtUtils, 'validateAndGetAdminAPIUser');

    jest.doMock('./gateway', () => {
      const actual = jest.requireActual('./gateway');
      return { getAppGateway: () => actual.getAppGateway({ supergraphSdl }) };
    });
    app = (await import('./main')).default;

    // Wait until the gateway has loaded the supergraph.
    for (let i = 0; i < 50; i++) {
      const res = await request(app).get('/.well-known/apollo/server-health');
      if (res.status === 200) break;
      await new Promise((r) => setTimeout(r, 100));
    }
  });

  beforeEach(() => {
    validate.resolves({ name: 'Test User', groups: [], username: 'test' });
  });

  afterAll(() => sinon.restore());

  const query = (variables: Record<string, unknown>) =>
    request(app).post('/').set('authorization', 'Bearer test-jwt').send({
      query: 'query ($limit: Int!) { item(limit: $limit) }',
      variables,
    });

  it('serves the health check used by ECS and the ALB', async () => {
    const res = await request(app).get('/.well-known/apollo/server-health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'pass' });
  });

  it('allows cross-origin requests', async () => {
    const res = await request(app)
      .options('/')
      .set('origin', 'https://curation.example')
      .set('access-control-request-method', 'POST')
      .set('access-control-request-headers', 'authorization,content-type');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  it('returns 400 for variable coercion errors', async () => {
    const res = await query({ limit: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].extensions.code).toBe('BAD_USER_INPUT');
  });

  it('returns 500 when the JWT is missing', async () => {
    const res = await request(app).post('/').send({ query: '{ __typename }' });
    expect(res.status).toBe(500);
    expect(res.body.data).toBeUndefined();
  });

  it('returns 400 UNAUTHENTICATED when the JWT is invalid', async () => {
    validate.resetBehavior();
    validate.callThrough();
    const res = await request(app)
      .post('/')
      .set('authorization', 'Bearer not-a-jwt')
      .send({ query: '{ __typename }' });
    expect(res.status).toBe(400);
    expect(res.body.errors[0].extensions.code).toBe('UNAUTHENTICATED');
  });
});
