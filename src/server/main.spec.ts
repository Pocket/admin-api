import { contextFactory } from './context';
import sinon from 'sinon';
import * as jwtUtils from '../jwtUtils';

describe('Context factory function', () => {
  it('multiple invocations only fetch public keys once', async () => {
    const keyStub = sinon.stub(jwtUtils, 'getSigningKeysFromServer').resolves({
      testKID: 'hereisalongkidstring',
    });
    await contextFactory({ req: { headers: {} } });
    await contextFactory({ req: { headers: {} } });
    await contextFactory({ req: { headers: {} } });

    expect(keyStub.callCount).toEqual(1);

    keyStub.restore();
  });
});
