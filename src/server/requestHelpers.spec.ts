import {
  addRecordToRequestHeader,
  buildRequestHeadersFromPocketUser,
  buildRequestHeadersFromWebRequest,
  extractHeader,
} from './requestHelpers';
import { GraphQLRequest } from 'apollo-server-types';
import { Headers } from 'apollo-server-env';
import { PocketUser } from '../jwtUtils';
import { IContext } from './context';

describe('request helpers', () => {
  let request: GraphQLRequest;

  beforeEach(() => {
    request = {
      http: {
        url: 'testing.is.ok',
        method: 'POST',
        headers: new Headers(),
      },
    };
  });

  it("adds the pocket user's properties and values as headers in a request", () => {
    const pocketUser: PocketUser = {
      userId: '1',
      email: 'test@email.com',
    };

    const subgraphRequest = buildRequestHeadersFromPocketUser(
      request,
      pocketUser
    );

    const headers = subgraphRequest.http.headers;
    expect(headers.get('userId')).toEqual('1');
    expect(headers.get('email')).toEqual('test@email.com');
  });

  it('adds web repo specific headers to a request', () => {
    const webRequest: IContext['webRequest'] = {
      userAgent: 'Test;This;Not;That',
      ipAddress: '1.2.3.4',
      language: 'en',
      snowplowDomainUserId: 'sn1ow',
    };

    const subgraphRequest = buildRequestHeadersFromWebRequest(
      request,
      webRequest
    );

    const headers = subgraphRequest.http.headers;
    expect(headers.get('gatewayUserAgent')).toEqual('Test;This;Not;That');
    expect(headers.get('gatewayIpAddress')).toEqual('1.2.3.4');
    expect(headers.get('gatewaySnowplowDomainUserId')).toEqual('sn1ow');
    expect(headers.get('gatewayLanguage')).toEqual('en');
  });
  it('copies arbitrary key-value strings to request headers', () => {
    const arbitraryObject = {
      ice: 'cannon',
      tShirt: 'cube',
      'x-forwarded-for': 'myip',
    };
    addRecordToRequestHeader(arbitraryObject, request);
    expect(request.http.headers.get('ice')).toEqual('cannon');
    expect(request.http.headers.get('tShirt')).toEqual('cube');
    expect(request.http.headers.get('x-forwarded-for')).toEqual('myip');
  });
  it('extracts first value from string array, or returns the string', () => {
    const someFakeHeaders = {
      yeet: 'yoink',
      words: ['yeet', 'yoink'],
    };
    expect(extractHeader(someFakeHeaders.yeet)).toEqual('yoink');
    expect(extractHeader(someFakeHeaders.words)).toEqual('yeet');
  });
});
