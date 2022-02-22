import * as jwtUtils from './jwtUtils';

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
});
