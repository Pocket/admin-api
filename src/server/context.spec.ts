import { getAppContext } from './context';
import { expect } from 'chai';

describe('context', () => {
  it('creates the app context using appropriate web repo headers from an apollo request context', async () => {
    const requestContext = {
      req: {
        headers: {
          'web-request-user-agent': 'Could;Be;Real',
          'web-request-ip-address': '1.2.3.4',
        },
      },
    };

    const context = await getAppContext(requestContext, {
      kid: 'fakepublickey',
    } as Record<string, string>);

    expect(context.webRequest).to.deep.include({
      userAgent: 'Could;Be;Real',
      ipAddress: '1.2.3.4',
    });
  });

  it('returns undefined for a webRequest properties when required headers are not found in apollo request context', async () => {
    const requestContext = {
      req: {
        headers: {
          'web-request-not-valid': 'nope',
          'no-way-this-is-used': 'facts',
        },
      },
    };

    const context = await getAppContext(requestContext, {
      kid: 'fakepublickey',
    } as Record<string, string>);

    expect(context.webRequest).to.deep.include({
      userAgent: undefined,
      ipAddress: undefined,
      snowplowDomainUserId: undefined,
      language: undefined,
    });
  });
});
