import { contextFactory } from './context';
import sinon from 'sinon';
import * as jwtUtils from '../jwtUtils';

describe('Context factory function', () => {
  it('multiple invocations only fetch public keys once', async () => {
    const keyStub = sinon.stub(jwtUtils, 'getSigningKeysFromServer').resolves({
      testKID: 'hereisalongkidstring',
    });

    // mock JWT validation
    sinon.stub(jwtUtils, 'validateAndGetAdminAPIUser').resolves({
      name: 'test name',
      groups: ['test group'],
      username: 'testUserName',
    });

    await contextFactory({
      req: { headers: { authorization: 'Bearer TestRawJWT' } },
    });
    await contextFactory({
      req: { headers: { authorization: 'Bearer TestRawJWT' } },
    });
    await contextFactory({
      req: { headers: { authorization: 'Bearer TestRawJWT' } },
    });

    expect(keyStub.callCount).toEqual(1);

    keyStub.restore();
  });
});
