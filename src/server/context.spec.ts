import sinon from 'sinon';

import * as jwtUtils from '../jwtUtils';
import { getAppContext } from './context';

describe('context', () => {
  describe('getAppContext', () => {
    beforeAll(() => {
      // mock JWT validation
      sinon.stub(jwtUtils, 'validateAndGetAdminAPIUser').resolves({
        name: 'test name',
        groups: ['test group'],
        username: 'testUserName',
      });
    });

    afterAll(() => {
      sinon.restore();
    });

    it('should return a context if the request has a JWT', async () => {
      const request = {
        headers: {
          authorization: 'Bearer TestJWT',
        },
      };

      const publicKeys = {
        test: 'test',
      };

      const context = await getAppContext({ req: request }, publicKeys);

      // context should have expected properties set
      expect(context.token).not.toBeNull();
      expect(context.forwardHeaders).not.toBeNull();
    });

    it('should throw if the request does not have a JWT', async () => {
      const request = {
        headers: {
          someNonAuthorizationHeader: 'someValue',
        },
      };

      const publicKeys = {
        test: 'test',
      };

      // creating context should throw if authorization header is missing
      await expect(getAppContext({ req: request }, publicKeys)).rejects.toThrow(
        new Error('Internal server error'),
      );
    });
  });
});
