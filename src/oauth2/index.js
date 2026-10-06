/**
 * OAuth 2.1 authorization server, the pieces every Profullstack app needs so its
 * CLI, TUI, MCP server and desktop app can sign in as a user without pasting keys.
 *
 * What OAuth 2.1 requires, and what this does:
 *  - authorization code only (no implicit, no password grant);
 *  - PKCE on every request, S256 only (`plain` is refused);
 *  - exact redirect URI matching, except the RFC 8252 loopback rule: a native
 *    client registered with http://127.0.0.1/callback may use any port;
 *  - refresh tokens rotate on every use, and presenting an already-used refresh
 *    token revokes the whole family (it means a copy leaked);
 *  - codes are single-use and live 5 minutes; access tokens 1 hour; refresh 90 days.
 *
 * Only hashes of codes and tokens are stored. Storage is a small interface, so
 * an app keeps its own database: see ./postgres.js, or memoryStore() for tests.
 *
 *   const oauth = createOAuthServer({ store, clients, issuer: 'https://pwamart.com', tokenPrefix: 'pm' });
 *   const code = await oauth.issueCode({ userId, clientId, redirectUri, codeChallenge, codeChallengeMethod, scope });
 *   const tokens = await oauth.exchangeCode({ code, clientId, redirectUri, codeVerifier });
 *   const next = await oauth.refresh({ refreshToken, clientId });
 *   const who = await oauth.verifyAccessToken(bearer); // { userId, clientId, scope } | null
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const CODE_TTL_MS = 5 * 60_000;
export const ACCESS_TTL_MS = 60 * 60_000;
export const REFRESH_TTL_MS = 90 * 86400_000;

export class OAuthError extends Error {
  /** `code` is the RFC 6749 error string the token endpoint answers with. */
  constructor(code, description, status = 400) {
    super(description || code);
    this.code = code;
    this.status = status;
  }
  toJSON() {
    return { error: this.code, error_description: this.message };
  }
}

const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const b64url = (buf) => Buffer.from(buf).toString('base64url');
const token = (prefix, kind) => `${prefix}_${kind}_${b64url(randomBytes(32))}`;

/** PKCE S256: BASE64URL(SHA256(verifier)) === challenge, compared in constant time. */
export function verifyPkce(verifier, challenge) {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(b64url(createHash('sha256').update(verifier).digest()));
  const expected = Buffer.from(String(challenge));
  return computed.length === expected.length && timingSafeEqual(computed, expected);
}

/** RFC 8252 §7.3: loopback redirects match on everything but the port. */
export function redirectMatches(registered, presented) {
  if (registered === presented) return true;
  let a;
  let b;
  try {
    a = new URL(registered);
    b = new URL(presented);
  } catch {
    return false;
  }
  const loopback = (u) => u.protocol === 'http:' && ['127.0.0.1', '[::1]', 'localhost'].includes(u.hostname);
  return loopback(a) && loopback(b) && a.hostname === b.hostname && a.pathname === b.pathname && a.search === b.search;
}

/** In-memory store: tests and single-process tools. Not for production. */
export function memoryStore() {
  const codes = new Map();
  const tokens = new Map();
  return {
    async saveCode(row) {
      codes.set(row.codeHash, { ...row, used: false });
    },
    async takeCode(codeHash) {
      const row = codes.get(codeHash);
      if (!row || row.used) return null;
      row.used = true;
      return row;
    },
    async saveToken(row) {
      tokens.set(row.tokenHash, { ...row, revoked: false, used: false });
    },
    async getToken(tokenHash) {
      return tokens.get(tokenHash) ?? null;
    },
    async markUsed(tokenHash) {
      const row = tokens.get(tokenHash);
      if (!row || row.used || row.revoked) return false;
      row.used = true;
      return true;
    },
    async revokeFamily(familyId) {
      for (const row of tokens.values()) if (row.familyId === familyId) row.revoked = true;
    },
  };
}

/**
 * @param {object} opts
 * @param {object} opts.store     memoryStore() or postgresStore(sql)
 * @param {Record<string,{redirectUris:string[], name?:string}>} opts.clients  public clients by id
 * @param {string} opts.issuer
 * @param {string} [opts.tokenPrefix]  e.g. 'pm' -> pm_at_…, pm_rt_…
 */
export function createOAuthServer({ store, clients, issuer, tokenPrefix = 'oa', scopes = ['read', 'write'] }) {
  if (!store) throw new Error('createOAuthServer needs a store');
  const client = (id) => {
    const c = clients[id];
    if (!c) throw new OAuthError('invalid_client', 'unknown client_id', 401);
    return c;
  };
  const normalizeScope = (scope) => {
    const asked = String(scope || scopes.join(' ')).split(/\s+/).filter(Boolean);
    const bad = asked.filter((s) => !scopes.includes(s));
    if (bad.length) throw new OAuthError('invalid_scope', `unknown scope ${bad.join(' ')}`);
    return asked.join(' ');
  };

  /** Validate an /authorize request before showing consent. Returns the clean params. */
  function validateAuthorize(q) {
    if (q.response_type !== 'code') throw new OAuthError('unsupported_response_type', 'response_type must be code');
    const c = client(q.client_id);
    if (!c.redirectUris.some((r) => redirectMatches(r, q.redirect_uri)))
      throw new OAuthError('invalid_request', 'redirect_uri is not registered for this client');
    if (!q.code_challenge) throw new OAuthError('invalid_request', 'PKCE is required: send code_challenge');
    if ((q.code_challenge_method || 'plain') !== 'S256') throw new OAuthError('invalid_request', 'code_challenge_method must be S256');
    if (!q.state) throw new OAuthError('invalid_request', 'state is required');
    return {
      clientId: q.client_id,
      clientName: c.name ?? q.client_id,
      redirectUri: q.redirect_uri,
      codeChallenge: q.code_challenge,
      scope: normalizeScope(q.scope),
      state: q.state,
    };
  }

  /** After the user approves: the URL to send the browser back to. */
  async function approve({ userId, clientId, redirectUri, codeChallenge, scope, state }) {
    const code = b64url(randomBytes(32));
    await store.saveCode({
      codeHash: sha256(code),
      userId,
      clientId,
      redirectUri,
      codeChallenge,
      scope,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    });
    const u = new URL(redirectUri);
    u.searchParams.set('code', code);
    u.searchParams.set('state', state);
    u.searchParams.set('iss', issuer);
    return u.toString();
  }

  function denyUrl({ redirectUri, state }) {
    const u = new URL(redirectUri);
    u.searchParams.set('error', 'access_denied');
    u.searchParams.set('state', state);
    return u.toString();
  }

  async function mint({ userId, clientId, scope, familyId }) {
    const access = token(tokenPrefix, 'at');
    const refresh = token(tokenPrefix, 'rt');
    const fam = familyId ?? b64url(randomBytes(16));
    const now = Date.now();
    await store.saveToken({ tokenHash: sha256(access), kind: 'access', userId, clientId, scope, familyId: fam, expiresAt: new Date(now + ACCESS_TTL_MS) });
    await store.saveToken({ tokenHash: sha256(refresh), kind: 'refresh', userId, clientId, scope, familyId: fam, expiresAt: new Date(now + REFRESH_TTL_MS) });
    return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_MS / 1000, refresh_token: refresh, scope };
  }

  async function exchangeCode({ code, clientId, redirectUri, codeVerifier }) {
    client(clientId);
    const row = code ? await store.takeCode(sha256(code)) : null;
    if (!row || new Date(row.expiresAt) < new Date()) throw new OAuthError('invalid_grant', 'code is invalid, used or expired');
    if (row.clientId !== clientId || row.redirectUri !== redirectUri) throw new OAuthError('invalid_grant', 'code was issued to another client or redirect_uri');
    if (!verifyPkce(codeVerifier, row.codeChallenge)) throw new OAuthError('invalid_grant', 'PKCE verification failed');
    return mint({ userId: row.userId, clientId, scope: row.scope });
  }

  async function refresh({ refreshToken, clientId }) {
    client(clientId);
    const row = refreshToken ? await store.getToken(sha256(refreshToken)) : null;
    if (!row || row.kind !== 'refresh' || row.clientId !== clientId) throw new OAuthError('invalid_grant', 'unknown refresh token');
    if (row.revoked) throw new OAuthError('invalid_grant', 'refresh token was revoked');
    if (row.used) {
      // Reuse of a rotated token: someone has a copy. Kill every token in the family.
      await store.revokeFamily(row.familyId);
      throw new OAuthError('invalid_grant', 'refresh token reuse detected; sign in again');
    }
    if (new Date(row.expiresAt) < new Date()) throw new OAuthError('invalid_grant', 'refresh token expired');
    if (!(await store.markUsed(row.tokenHash))) throw new OAuthError('invalid_grant', 'refresh token already used');
    return mint({ userId: row.userId, clientId, scope: row.scope, familyId: row.familyId });
  }

  /** The token endpoint body (form or JSON) -> tokens, or throws OAuthError. */
  async function token_(body) {
    const b = body ?? {};
    if (b.grant_type === 'authorization_code')
      return exchangeCode({ code: b.code, clientId: b.client_id, redirectUri: b.redirect_uri, codeVerifier: b.code_verifier });
    if (b.grant_type === 'refresh_token') return refresh({ refreshToken: b.refresh_token, clientId: b.client_id });
    throw new OAuthError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token');
  }

  async function verifyAccessToken(bearer) {
    const t = String(bearer ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!t.startsWith(`${tokenPrefix}_at_`)) return null;
    const row = await store.getToken(sha256(t));
    if (!row || row.kind !== 'access' || row.revoked || new Date(row.expiresAt) < new Date()) return null;
    return { userId: row.userId, clientId: row.clientId, scope: row.scope };
  }

  /** RFC 7009: revoking either token ends the whole sign-in (its family). Always succeeds. */
  async function revoke(tokenValue) {
    const row = tokenValue ? await store.getToken(sha256(String(tokenValue))) : null;
    if (row) await store.revokeFamily(row.familyId);
  }

  /** RFC 8414 metadata for /.well-known/oauth-authorization-server. */
  function metadata({ authorizePath = '/oauth/authorize', tokenPath = '/oauth/token', revokePath = '/oauth/revoke' } = {}) {
    return {
      issuer,
      authorization_endpoint: `${issuer}${authorizePath}`,
      token_endpoint: `${issuer}${tokenPath}`,
      revocation_endpoint: `${issuer}${revokePath}`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: scopes,
    };
  }

  return { validateAuthorize, approve, denyUrl, exchangeCode, refresh, token: token_, verifyAccessToken, revoke, metadata };
}
