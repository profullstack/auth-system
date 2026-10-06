import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTokenStore, getAccessToken, login, logout, pkcePair } from '../src/cli/index.js';
import { OAuthError, createOAuthServer, memoryStore, redirectMatches, verifyPkce } from '../src/oauth2/index.js';

const ISSUER = 'https://app.example';
const clients = { 'app-cli': { name: 'App CLI', redirectUris: ['http://127.0.0.1/callback', 'https://app.example/oauth/cli'] } };
const server = () => createOAuthServer({ store: memoryStore(), clients, issuer: ISSUER, tokenPrefix: 'ap' });

/** A fetch that answers the token and revoke endpoints from an in-process server. */
function fakeFetch(oauth) {
  return async (url, init = {}) => {
    const u = new URL(url);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
    if (u.pathname === '/.well-known/oauth-authorization-server') return json(200, oauth.metadata());
    const body = Object.fromEntries(new URLSearchParams(init.body));
    try {
      if (u.pathname === '/oauth/token') return json(200, await oauth.token(body));
      if (u.pathname === '/oauth/revoke') {
        await oauth.revoke(body.token);
        return json(200, {});
      }
    } catch (err) {
      return json(err.status ?? 400, err.toJSON());
    }
    return json(404, {});
  };
}

describe('oauth2 server', () => {
  it('PKCE S256 and the loopback redirect rule', () => {
    const { verifier, challenge } = pkcePair();
    expect(verifyPkce(verifier, challenge)).toBe(true);
    expect(verifyPkce(`${verifier}x`, challenge)).toBe(false);
    expect(redirectMatches('http://127.0.0.1/callback', 'http://127.0.0.1:53123/callback')).toBe(true);
    expect(redirectMatches('http://127.0.0.1/callback', 'http://evil.example/callback')).toBe(false);
    expect(redirectMatches('https://app.example/cb', 'https://app.example:8443/cb')).toBe(false);
  });

  it('refuses requests OAuth 2.1 forbids', () => {
    const s = server();
    const base = { response_type: 'code', client_id: 'app-cli', redirect_uri: 'http://127.0.0.1:5000/callback', code_challenge: 'x'.repeat(43), code_challenge_method: 'S256', state: 's' };
    expect(s.validateAuthorize(base).clientName).toBe('App CLI');
    expect(() => s.validateAuthorize({ ...base, response_type: 'token' })).toThrow(OAuthError);
    expect(() => s.validateAuthorize({ ...base, code_challenge_method: 'plain' })).toThrow(/S256/);
    expect(() => s.validateAuthorize({ ...base, code_challenge: undefined })).toThrow(/PKCE/);
    expect(() => s.validateAuthorize({ ...base, redirect_uri: 'https://evil.example/cb' })).toThrow(/redirect_uri/);
    expect(() => s.validateAuthorize({ ...base, client_id: 'nope' })).toThrow(/client_id/);
  });

  it('code -> tokens once; refresh rotates; reuse revokes the family', async () => {
    const s = server();
    const { verifier, challenge } = pkcePair();
    const redirect = await s.approve({ userId: 'u1', clientId: 'app-cli', redirectUri: 'http://127.0.0.1:5000/callback', codeChallenge: challenge, scope: 'read write', state: 'st' });
    const code = new URL(redirect).searchParams.get('code');
    const args = { code, clientId: 'app-cli', redirectUri: 'http://127.0.0.1:5000/callback', codeVerifier: verifier };
    await expect(s.exchangeCode({ ...args, codeVerifier: pkcePair().verifier })).rejects.toThrow(/PKCE/);
    // The failed attempt spent the code: codes are single-use even when wrong.
    await expect(s.exchangeCode(args)).rejects.toThrow(/invalid, used or expired/);

    const redirect2 = await s.approve({ userId: 'u1', clientId: 'app-cli', redirectUri: 'http://127.0.0.1:5000/callback', codeChallenge: challenge, scope: 'read write', state: 'st' });
    const t1 = await s.exchangeCode({ ...args, code: new URL(redirect2).searchParams.get('code') });
    expect(t1.access_token).toMatch(/^ap_at_/);
    expect(await s.verifyAccessToken(`Bearer ${t1.access_token}`)).toMatchObject({ userId: 'u1', scope: 'read write' });

    const t2 = await s.refresh({ refreshToken: t1.refresh_token, clientId: 'app-cli' });
    expect(t2.refresh_token).not.toBe(t1.refresh_token);
    await expect(s.refresh({ refreshToken: t1.refresh_token, clientId: 'app-cli' })).rejects.toThrow(/reuse detected/);
    // Reuse killed the whole family, including the newest tokens.
    expect(await s.verifyAccessToken(t2.access_token)).toBeNull();
    await expect(s.refresh({ refreshToken: t2.refresh_token, clientId: 'app-cli' })).rejects.toThrow(/revoked/);
  });
});

describe('cli login', () => {
  it('loopback sign-in end to end, auto-refresh, logout revokes', async () => {
    const s = server();
    const store = createTokenStore('app', { dir: mkdtempSync(join(tmpdir(), 'auth-cli-')) });
    // The "browser": approve as user u7 and follow the redirect to the CLI's loopback port.
    const open = async (url) => {
      const q = Object.fromEntries(new URL(url).searchParams);
      const p = s.validateAuthorize(q);
      const back = await s.approve({ ...p, userId: 'u7' });
      await fetch(back);
    };
    const t = await login({ issuer: ISSUER, clientId: 'app-cli', store, open, manual: false, fetch: fakeFetch(s), log: () => {} });
    expect(t.access_token).toMatch(/^ap_at_/);
    expect((await store.load()).refresh_token).toBe(t.refresh_token);

    // Force expiry: getAccessToken refreshes and stores the rotated pair.
    await store.save({ ...(await store.load()), expires_at: Date.now() - 1 });
    const fresh = await getAccessToken({ store, fetch: fakeFetch(s) });
    expect(fresh).not.toBe(t.access_token);
    expect(await s.verifyAccessToken(fresh)).toMatchObject({ userId: 'u7' });

    expect(await logout({ store, fetch: fakeFetch(s) })).toBe(true);
    expect(await store.load()).toBeNull();
    expect(await s.verifyAccessToken(fresh)).toBeNull();
  });

  it('a state mismatch on the loopback is refused', async () => {
    const s = server();
    const open = async (url) => {
      const q = Object.fromEntries(new URL(url).searchParams);
      const back = new URL(await s.approve({ ...s.validateAuthorize(q), userId: 'u1' }));
      back.searchParams.set('state', 'forged');
      await fetch(back).catch(() => {});
    };
    await expect(login({ issuer: ISSUER, clientId: 'app-cli', open, manual: false, fetch: fakeFetch(s), log: () => {} })).rejects.toThrow(/state mismatch/);
  });
});
