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
      nock('https://' + config.auth.pocket.jwtIssuer)
        .get('/.well-known/jwk')
        .reply(200, pocketJwks);

      const keys = await getSigningKeysFromServer();

      expect(Object.keys(keys)).toEqual([
        'kze4M0CiXoDO7Qkpig1oH0F6OInzZg6ugk0PyojOlzc=',
        '4w35mrh4EBECpjJnyIjdQ60yjh3xeI1m0VF1H/z0T/c=',
        'CURMIG',
      ]);

      cognitoMock.persist(false);
    });
  });
});
