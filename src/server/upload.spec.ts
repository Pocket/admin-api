import http from 'http';
import { AddressInfo } from 'net';
import { buildSchema, graphql, parse } from 'graphql';
import { composeServices } from '@apollo/composition';
import { processRequest } from 'graphql-upload';
import request from 'supertest';
import sinon from 'sinon';
import * as jwtUtils from '../jwtUtils';

// Mirrors curated-corpus-api's uploadApprovedCorpusItemImage mutation.
const typeDefs = `
  scalar Upload
  type UploadedFile {
    filename: String!
    mimetype: String!
    base64: String!
  }
  type Query {
    ok: Boolean
  }
  type Mutation {
    uploadApprovedCorpusItemImage(data: Upload!): UploadedFile
  }
`;

const readFile = async (upload): Promise<Record<string, string>> => {
  const { filename, mimetype, createReadStream } = await upload.promise;
  const chunks: Buffer[] = [];
  for await (const chunk of createReadStream()) chunks.push(chunk);
  return {
    filename,
    mimetype,
    base64: Buffer.concat(chunks).toString('base64'),
  };
};

/**
 * Stub subgraph that parses multipart requests with graphql-upload, like
 * curated-corpus-api does, and echoes the received file back.
 */
const startStubSubgraph = async (): Promise<http.Server> => {
  const schema = buildSchema(typeDefs);
  const server = http.createServer(async (req, res) => {
    let body;
    if (req.headers['content-type']?.startsWith('multipart/form-data')) {
      body = await processRequest(req, res);
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      body = JSON.parse(Buffer.concat(chunks).toString());
    }
    const result = await graphql({
      schema,
      source: body.query,
      variableValues: body.variables,
      rootValue: {
        uploadApprovedCorpusItemImage: ({ data }) =>
          data?.promise ? readFile(data) : null,
      },
    });
    res.setHeader('content-type', 'application/json');
    res.setHeader('connection', 'close');
    res.end(JSON.stringify(result));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  return server;
};

describe('file uploads', () => {
  let subgraph: http.Server;
  let app;

  beforeAll(async () => {
    subgraph = await startStubSubgraph();
    const { port } = subgraph.address() as AddressInfo;
    const { supergraphSdl, errors } = composeServices([
      {
        name: 'corpus',
        url: `http://localhost:${port}/`,
        typeDefs: parse(
          `extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])\n` +
            typeDefs,
        ),
      },
    ]);
    if (errors) throw errors[0];

    sinon.stub(jwtUtils, 'getSigningKeysFromServer').resolves({});
    sinon.stub(jwtUtils, 'validateAndGetAdminAPIUser').resolves({
      name: 'Test User',
      groups: ['mozilliansorg_pocket_scheduled_surface_curator_full'],
      username: 'test-user',
    });

    jest.doMock('./gateway', () => {
      const actual = jest.requireActual('./gateway');
      return { getAppGateway: () => actual.getAppGateway({ supergraphSdl }) };
    });
    app = (await import('./main')).default;
  });

  afterAll(async () => {
    sinon.restore();
    await new Promise((resolve) => subgraph.close(resolve));
  });

  it('forwards the uploaded file to the subgraph byte for byte', async () => {
    // Non-UTF-8 bytes catch any text re-encoding of the file stream.
    const bytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x0d, 0x0a,
    ]);
    const query = `mutation ($data: Upload!) {
      uploadApprovedCorpusItemImage(data: $data) { filename mimetype base64 }
    }`;

    // Retry until the gateway has finished loading the supergraph.
    let res;
    for (let i = 0; i < 50; i++) {
      res = await request(app)
        .post('/')
        .set('authorization', 'Bearer test-jwt')
        .set('apollo-require-preflight', 'true')
        .field(
          'operations',
          JSON.stringify({ query, variables: { data: null } }),
        )
        .field('map', JSON.stringify({ 0: ['variables.data'] }))
        .attach('0', bytes, {
          filename: 'image.png',
          contentType: 'image/png',
        });
      if (res.status !== 404) break;
      await new Promise((r) => setTimeout(r, 100));
    }

    expect(res.status).toBe(200);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.uploadApprovedCorpusItemImage).toEqual({
      filename: 'image.png',
      mimetype: 'image/png',
      base64: bytes.toString('base64'),
    });
  });

  it.each(['__proto__.polluted', 'constructor.prototype.polluted'])(
    'does not pollute Object.prototype via the upload path %s',
    async (path) => {
      const query = `mutation ($data: Upload!) {
        uploadApprovedCorpusItemImage(data: $data) { filename }
      }`;
      const res = await request(app)
        .post('/')
        .set('authorization', 'Bearer test-jwt')
        .set('apollo-require-preflight', 'true')
        .field('operations', JSON.stringify({ query, variables: { data: {} } }))
        .field('map', JSON.stringify({ 0: [`variables.data.${path}`] }))
        .attach('0', Buffer.from('x'), 'x.png');

      // The request reaches the subgraph, so the upload data source ran.
      expect(res.status).toBe(200);
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    },
  );
});
