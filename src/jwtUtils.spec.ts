import * as jwtUtils from './jwtUtils';
import nock from 'nock';
import config from './config';
import { getSigningKeysFromServer } from './jwtUtils';

describe('jwtUtils', () => {
  describe('buildAdminAPIUserFromPayload', () => {
    const payload: jwtUtils.CognitoUser = {
      given_name: 'steven universe',
      family_name: 'universe',
      name: 'steven universe',
      email: 'steven@crystalgems.org',
      'cognito:groups': ['crystal gems', 'diamonds'],
      'cognito:username': 'Auth0_ad|CrystalGems-LDAP|steven',
      'custom:groups': '["beach citywalk fries", "big donut"]',
      groups: ['idk', 'toomanygroups'],
      picture: 'some-picture-data-url.jpg',
      exp: 1,
      iat: 2,
      email_verified: 'true',
      identities: [{ userId: 'ad|CrystalGems-LDAP|steven' }],
    };

    it('should return the expected payload', () => {
      const result = jwtUtils.buildAdminAPIUserFromPayload(payload);

      const expected = {
        name: 'steven universe',
        groups: ['beach citywalk fries', 'big donut'],
        username: 'ad|CrystalGems-LDAP|steven',
      };

      expect(result).toEqual(expected);
    });

    it('should throw an error if identity is not present', () => {
      const badPayload = { ...payload, identities: [] };

      expect(() => {
        jwtUtils.buildAdminAPIUserFromPayload(badPayload);
      }).toThrow('JWT payload missing identity information');
    });
  });

  describe('getSigningKeysFromServer', () => {
    const cognitoJwks = {
      keys: [
        {
          alg: 'RS256',
          e: 'AQAB',
          kid: 'kze4M0CiXoDO7Qkpig1oH0F6OInzZg6ugk0PyojOlzc=',
          kty: 'RSA',
          n: 'uXk44uWZ2tx',
          use: 'sig',
        },
        {
          alg: 'RS256',
          e: 'AQAB',
          kid: '4w35mrh4EBECpjJnyIjdQ60yjh3xeI1m0VF1H/z0T/c=',
          kty: 'RSA',
          n: '7LjXOvCWl6Y',
          use: 'sig',
        },
      ],
    };
    const mozillaAuthProxyJwks = {
      keys: [
        {
          alg: 'RS256',
          e: 'AQAB',
          kid: 'OR8erz5A8/hCkVdHczk879k2zUQXoAke9p8TQXsgKLQ=',
          kty: 'RSA',
          n: 'vHxdjnAQDDHUo0cMBLEiO3wpBC3VSpevy4ccOlBy2TmuqeyOwz65-L_bTJQjgqCFTFT8JfOsklumWT37gU9BAaxyCWk455ALwf8aq_FDjyArnRVXChIAEVfjy40WtmaEbEp-RJVh83vI31F1HtIoHgq7yQRd76GBjxXQDKsvs4zbeVK_MTKK0LtfQKNT1lOCFOVHUVu3_-7lzl-zrY7_OX5v6mU4AtrqfKTr1t06BdlPTFu06-3Ug-LuyLgwiC4AFp4P3XpM_MaMElHObFKRvqp9GLoknLhSymUAGEORbzr5J7PvWxf7XWNl0zlozYg-vtKHv5bcNNU7K2gvdqMxtQ',
          use: 'sig',
        },
        {
          alg: 'RS256',
          e: 'AQAB',
          kid: 'QtBbT/twDz6JmT99PQkAOB+QBhG4eJvxk8pOr7YzfWU=',
          kty: 'RSA',
          n: 'tvivV24KuPtRi2ehzTCv5Wzu_zi39r0vW38bd2drNUJpAFVhoFcoc9F9Mq4rnbN4bZyW3a6uDeUUKAG5MiZC7oZheqCLrdNkYO7Zao25X1GpycFIVnNccVFyyeS_qvYauXOR1B8rzPub9bf9z9jIRCX5wQ675FNsanwpAT-ZhWjoT3PQnHaMvNHD4d4_J6ObCO8GFZqn2NTflYeeob_-iZxlKR_EI1xz9S_8FRVMIpHvudmKvE1Gc3HLo1S6tGo4Fvep9k4elae_54Z4a-DaI3F_j3MtQ7V8WMZEGd5qXrfFxFDV5t45YJBwWlCWPxY9ESyMJKlknLkPEZs45G6vMw',
          use: 'sig',
        },
      ],
    };
    const pocketJwks = {
      keys: [
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'CURMIG',
          alg: 'RS256',
          n: 'sI5Sttlr',
        },
      ],
    };
    it('should get keys from cognito and pocket', async () => {
      const cognitoMock = nock('https://' + config.auth.cognito.jwtIssuer)
        .persist()
        .get('/.well-known/jwks.json')
        .reply(200, cognitoJwks);
      const mozillaAuthProxyMock = nock(
        'https://' + config.auth.mozillaAuthProxy.jwtIssuer
      )
        .persist()
        .get('/.well-known/jwks.json')
        .reply(200, mozillaAuthProxyJwks);
      nock('https://' + config.auth.pocket.jwtIssuer)
        .get('/.well-known/jwk')
        .reply(200, pocketJwks);

      const keys = await getSigningKeysFromServer();

      expect(Object.keys(keys)).toEqual([
        'kze4M0CiXoDO7Qkpig1oH0F6OInzZg6ugk0PyojOlzc=',
        '4w35mrh4EBECpjJnyIjdQ60yjh3xeI1m0VF1H/z0T/c=',
        'OR8erz5A8/hCkVdHczk879k2zUQXoAke9p8TQXsgKLQ=',
        'QtBbT/twDz6JmT99PQkAOB+QBhG4eJvxk8pOr7YzfWU=',
        'CURMIG',
      ]);

      cognitoMock.persist(false);
      mozillaAuthProxyMock.persist(false);
    });
  });
});
