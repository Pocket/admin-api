import * as jwtUtils from './jwtUtils';
import nock from 'nock';
import config from './config';

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
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
      // Reset the module registry before each test to allow a changed environment to
      // be reflected in the config that is imported.
      jest.resetModules();
    });

    afterEach(() => {
      // Reset NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });

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
          kid: 'PK11T',
          alg: 'RS256',
          n: 'opRmJSXayvQsg7Iz2Tj-8CjoqCGPQyXcHcd4hXH3uHPwKlQ4hUDj48_Q58Gvkuw2BbZXRys9jca9fHeNinl_JoltyJwdDx-FgpxwRRsWoZtBDvDrFYMpuaBOi3Vp8YaUWmTeJtKlM-ONIlXDZgJvrnRtQkRJpBN6sHFXJNs1SxaQveAplgeRHlC-X_OyLc-2gJWTFlJkNkCZibtgAx9UELqbOe52gaTXhdQ4izLlaLn5aTcu0hJnesOYgi2ZIXExV9R2lugNKOrWt2WX-5h9E2v8OqhQafFcDYumyY9NSoQ7FgNKB_TPmKE4mkNnOJfgiPC591B2URFtPML64UMuaw',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: '8p1t74',
          alg: 'RS256',
          n: 'mMiInSGsxl4GO7prGi13h6TnRVKd1BrRxieHJHNuKQ3CGhylksP2i97ZXAh5zSkebgLqxeWWBDkFRBoBNItY2ZsqZTW9Vl1PCEYrZTzuUWXHr7KsRRpyBZu9Xzzr3_mxJ24hDaRqkEd-jEgSh6ROnnTcvZI_sgt8pPDlQ9Gbp8eM5CGnlEy5oOvKXBFXgvTOenet2O7lqIjVzoOvwEBLiBpSsQ_2mMwMhvH-p0NQXmQRklpn_fvXNS_TgPpx_xNBgdiZEGZcwpuh8iKVGFXJzljSimq3gtUeEHvPWh4E-y2lLWQ7BmZJNkJtfBPdM0R-66DozXsqDM6m9jilyh9aAQ',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'CURMIG',
          alg: 'RS256',
          n: 'sI5SttlrJzjWAro-_WVdWyrNVY69txqBP_VFojbqZ_WaSYonTGDW18xA-78xAdP_fAHan_auFRddo8DCjjzyB0qKjsUiqsXQBGZzHrCGYVty9VpAhZudFMiu1iUrZ1TOFmcPgs8vadonzBRDpS5p7cCQAsQSDXBuXH45W-PKJBLLvVs-C1vODrTnk9f4ME1A4XPMK7fq7pxoIUxWceCKcWAio1qfm-E2DwD_tocwZY7dNX8zCGBaPOUI5QqwR3D8ntjw-hO_c_vyi5X2Zmg6jiNRHC7xiMFSLX5ycfxQ49c2m750zq0qaoTWFQdVFcQHBiGAq5AtAN7vwUJ0OlCiHw',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'CORPSL',
          alg: 'RS256',
          n: 'ie88qkHtBkGqAYqLr5gyZREX6n4yZjktegxOIoc8IAobgfOYYKAZQFwzoK7Fm2PIeBQaRFNfybrd1vD7ZUMboiEy-nEKl85GIe6CUcumGBcKjHA5q2AxMMkao091Z1u9wRqNG5zs1YbCSZTWy0GhWbsZhfC8yaiJmZe4FwfvvF5C3Ey-mQLRysFygW7gW_wO2S_8MvRkmFmnhiR-Ftu9Z1xM1QV2angPpt_cvvOOoB5rEFVFJOUITSRua1sboDCGzBQu7CbuRY1jQeG-IWSlEV87xjYPeF4U9PUUm7APu25iBDabY19FD7dO1jIDGG2Ti0V_4wCcZYbTRri3kHpEHw',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'CORDEV',
          alg: 'RS256',
          n: 'nRZvSwCb9RZyTgOB1ZS-b83du6YCia3jWKlC7hnWJhsDW3AJRjb_YQf2XyLbPN0C6d9aoCPLGgLbaY9lclbXjT3iDxISLZl3h5ub_G4yLVGc2sv6JtTJSTevlxEB5uzWR0tBFxg0QsmY2gcoF1f0X3YS2YSWRq0G-gtIUuU3U4JhXtpUponYxcE8LR8DSZ6P6BcYMWaBVX5X8KztSHiIug5pGvlWlf0rq2wNMz6EbgrO8H3vOitdPWmlxrV86Drm8hdVJV3JUU_uKitc1MFjaJUSt1FpXWzJrQIdGDTzYzne6M76qWQZw_IPf6VB_FVskWSH6UkvX4i0sNvzOKbMOQ',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'CMGDEV',
          alg: 'RS256',
          n: 'q8ft1Rs-kUFWlsiGZeZLgc85iNi3dKWQUhAurSfh00q7oltZFam4djkwLMfTJ2mTlobMMXYppilGN_liZkRZg8W3hFxYY_lwGseDvCtiUMXrPDauF4fjCxnc3RNFsaeqfouOsTktBVuwGC2j-aEPVbdyIqppZ3kwkiRRkYioJae4I1Djabzc8Q48VhVbuWDc1-QWpyGHel73mUFVbLPleLqu-4-LrDquaxRDrd65d3CP0LpYwQSzb6bsVvvCB0YSJKCi1top-ZkrVfw_O0toukAJIK-QN7vxcOga_CEraa-J-I9VdEtY0gjsO_70FZ9BNueBMpCJoGbrMQR923YxBQ',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'SEMGRL',
          alg: 'RS256',
          n: 'sjOK-Rmytt_g8F-9FImGHCKwkPBlgr_DpBTw3Y5esLYTJAqXsQwGtJf2OR4azGcbec5796fE9lhnLEmi6MFz0oBDxhPHwMCyf9DBZhsCVUmAIysosOqeDdxFB_9upCCcYvMpty8hrgoJp9U01ITnYVxRYCSwnJnjJFkxyA2ZXhlMjYwI0W5qo9tUXMwyEnt8408gK_etKrj6A24-oxMpau_gSxSgZDxAi2vpNEapX-hYV0grofnEy25dtHu_5xVVPlDpeQzGWdfRbFQKJKv8km3wvgvv0CsC-CukPZd40kHQiq71a47zNL4OyM-FcGt_KfuZDuFy79g5I8KEFsZOJw',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'SMGRDV',
          alg: 'RS256',
          n: 'ja9Fr70SvubM7UFsQKUAHWk86nLCgX3zpUnutqMcfrUfFkWRZ3PQiFuE0UL96ao3RPEuY0eXZaIy3ts0B3YgBo_XUEefbW4V_bRFgsZKJwRvQNUzvYincKxOPQPWqGZqXemqqQFkZguBKiYxBMmhgJytcuFGZ1VfpkttOVGvJS1_Qp2Dp-vimjYaLzTCYTmERsjVXDkWUisMeYY-Sifm4ZdXebVUOs3t4by3mKcdVdoELWjuU_OXlkwREEZACWiA4hVr4PsmaEHF5JDMUaNKb-0pJ0S3YyEUCRy7AYC4GMl24_aHJbKxZEKtsfqYVtWWKSuAg4S7HJmHnIGrliIV9w',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'MLMFLO',
          alg: 'RS256',
          n: 'yicMceL_WewoBa2gQNRxuIvXWNlSBo9ojrtYj0pp2g1SiA3SP9eQ4nzyppF02FbdynpukxgIQbQcLt1TkRBZBcU1T1iAPkYHZlP8CCb_EnckjkNzNNWQSrV-oh_OeNInvHqEoAwrAO__6MUAR13tDo0GKiCdZPV4UAAOpvkoKWv_tzK4jdBqJlbVM3eaxELk7G5n7lycuDuCmirVFrBXpitITvZm-yotFH0YkONdskkeE0GewTmEFXpDgOrSUChEe3W22cKoPqY7c5iI9sff_MpXX3Ch5WY4j-3I9bG7hGXagjkxoaRq39h2_a0HeiHqey9iJvyjoLm0qBiDkU7V_w',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'MLMDEV',
          alg: 'RS256',
          n: 'vISjSfh6aVnBhsKpv2-P6Vdy3eVABvqkHrGx0qC1S168qMVgBRmGgHp1175kbcb1efyI9_n4LzKIujr1O1RPZnOJ1iwYxPDGCL5tyV-Z8Tsd_m2tb2kfiZ6V4uctAiI2Be9OVG2TfZ8sDsE0IwdJfnTlXry6b_LIfvSVRZtCaQbWTqsNhuI5KHA621eQf768AsLwI5mszYFakYSJxXcJUi_fUmOcnIFIEtqk7adv6JtgUUGxg6t9o1m070-kZMA8taIUuNI8aCi2zWF8JytNz9ZUj1cU5ozsC_9dLTLzEMLc5K9FOMjAFWSTzy9A2iNlB7g6T3rlckDUWa80866cOQ',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'PROTRL',
          alg: 'RS256',
          n: 'hA1NazIZXLCIV0RRFUFFjYhBo_VjpGf9sQ_v4Nw-EwV-uVMHrhh3TRMibv-m9nOvua__ys3hJhYRy86aEpyQbq-L5lhE7WSSPRARnlspb0dBq8HvxhiKop1tPsmBv5t0E-Mmu8pRvqvfAVXUY4NgtsviVSKltvFEaWZ0TZ-Y8QGo_MowYxnN4nULgkCZ_aYI8o4fszJz2Onm3by6Nirw3YP6VFROjPIZ8vh48CwMUBSPGgpmFR79T7duhLyDlM0yOP6QMdUlu9L_4yWoaaI3tz0R0qUTPapiYwW7R7YRzOG39-tYxWjXwPLMW4MAS8gRo72GYr9xAEUPxBaL5KuPeQ',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'PTLDEV',
          alg: 'RS256',
          n: 'iNM-STUulZNU3nSYb73O3Yg_ABRCKPxblxEmRdgw85hp50vwo28xLjxE5A49lbCMJGPfm1fyhfgNut0O6anIqw6YsBFx0ShnWB0LZR9sn0qE2el2qODQ1WMdYFyRzKrk4qfST4ziOqZ18L9e_o2Q0U8NgtN3tNj9m9oUDRI0gU1RJycCXAMHhYb-_i3rpbuyFGbs0wl4Ze2RA5cea3ImgioOpsmNyAs4oUTIAOWM940lw9L4J2pIBkXzuDBigc7A2VP0tNTTwd4SxJCsRaLH7WC5tXtR69qCOs_c3wNzHDrXXhdDJS1cjhUz7aYebdYBEjerYKr6xV2ExE-0OPkrpQ',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'HNTCPP',
          alg: 'RS256',
          n: '0I3tZUcI2lGl9YTwitogqHEJVFwF4JXY_d0IsEgyvehHfDzn1-xwavoGCcZEae1kzkJCAybZWI8HRd5LvDv_42LeSXw1FdsiepeVUbRMr6SjrIU9nWW5Uy7bBBWSlt_p9YkCye_gnSVS4PqbXBVWDNhKixlMtiQ8wMDgYIt3cUmvgVE7j_Q2CzOAwT2cKTIIoABMCid1nqa79axcZMROuyOliw6KT4J0kTxGJAm4PYsRSdPN6aVyfzBf25W6cjQjIiulQuCIdxHniNj-Gnpp2Op3CL1imuXq0VoVt388thiDKu3On0pXAkKDwZlPnahNwknkNnm6tMYuNujfwK6iBw',
        },
        {
          kty: 'RSA',
          e: 'AQAB',
          use: 'sig',
          kid: 'HNTCPN',
          alg: 'RS256',
          n: 'vxcuwdvWWdRJu00HZmNWuQ9gi3h-LnVav4E_WMCik9v3zwPjc9xVAkA9GDMDSz8qeyDqfCkgbpwbETg25PwlEbrSae87UeGT9AusWMfXjnNLaGrB2RtPxkgi6-jaRsmu8zgjXmTXMIbg-liRO16wENGIyDvGwc8_q7y3mQYCh5fKtWhATSezbxf9BDMApM0XhFIYdGE5mbQIv_iBkDKGAHbrkVmpAzc6RJHuhiTCuEre-XN_pvVPrXssu9QMqpmsNCwara3FfT-7L0YQVUfGTiTUUIiBTeFlzn9PvoRnQUSRKzF2HVHgCpZoPixChYh_NQH2JdbCuK7UFCZ1WzTfIQ',
        },
      ],
    };

    it.each(['production', 'development'])(
      `should get keys from mozilla auth proxy and pocket in %s`,
      async (env) => {
        // Override NODE_ENV and dynamically import getSigningKeysFromServer to re-compute the config in the given env.
        process.env.NODE_ENV = env;
        const { getSigningKeysFromServer } = await import('./jwtUtils');

        const expectedKids = [
          'OR8erz5A8/hCkVdHczk879k2zUQXoAke9p8TQXsgKLQ=',
          'QtBbT/twDz6JmT99PQkAOB+QBhG4eJvxk8pOr7YzfWU=',
          ...(env === 'development'
            ? ['CMGDEV', 'CORDEV', 'SMGRDV', 'MLMDEV', 'PTLDEV', 'HNTCPN']
            : ['CURMIG', 'CORPSL', 'SEMGRL', 'MLMFLO', 'PROTRL', 'HNTCPP']),
        ];

        const mozillaAuthProxyMock = nock(
          'https://' + config.auth.mozillaAuthProxy.jwtIssuer,
        )
          .persist()
          .get('/.well-known/jwks.json')
          .reply(200, mozillaAuthProxyJwks);
        nock('https://' + config.auth.pocket.jwtIssuer)
          .persist()
          .get('/.well-known/jwk')
          .reply(200, pocketJwks);

        const keys = await getSigningKeysFromServer();

        expect(Object.keys(keys)).toEqual(expectedKids);

        mozillaAuthProxyMock.persist(false);
      },
    );
  });
});
