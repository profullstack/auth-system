/**
 * OAuth 2.1 sign-in for command-line tools (and TUIs, stdio MCP servers, desktop
 * shells): the client half of ../oauth2. One call opens the browser, waits for
 * the redirect on a loopback port (RFC 8252), checks state, swaps the code with
 * its PKCE verifier and stores the tokens 0600 under ~/.config/<app>/auth.json.
 * getAccessToken() refreshes (and stores the rotated refresh token) when the
 * access token is about to expire, so every surface of an app shares one sign-in.
 *
 * Headless (SSH, no DISPLAY): pass `manual: true` and a `manualRedirectUri` the
 * server renders as "paste this code"; the user pastes it back at the prompt.
 *
 *   const store = createTokenStore('pwamart');
 *   await login({ issuer: 'https://pwamart.com', clientId: 'pwamart-cli', store });
 *   const token = await getAccessToken({ store });   // Bearer pm_at_…
 *   await logout({ store });
 */
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir, platform } from 'node:os';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function pkcePair() {
  const verifier = b64url(randomBytes(48));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' };
}

/* ------------------------------------------------------------ token store -- */

export function createTokenStore(app, { dir } = {}) {
  const file = join(dir ?? join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), app), 'auth.json');
  return {
    file,
    async load() {
      try {
        return JSON.parse(await readFile(file, 'utf8'));
      } catch {
        return null;
      }
    },
    async save(data) {
      await mkdir(dirname(file), { recursive: true, mode: 0o700 });
      await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
      return file;
    },
    async clear() {
      await rm(file, { force: true });
    },
  };
}

/* --------------------------------------------------------------- helpers -- */

export async function discover(issuer, fetchImpl = fetch) {
  const base = issuer.replace(/\/+$/, '');
  for (const path of ['/.well-known/oauth-authorization-server', '/.well-known/openid-configuration']) {
    try {
      const res = await fetchImpl(`${base}${path}`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) return await res.json();
    } catch {}
  }
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    revocation_endpoint: `${base}/oauth/revoke`,
  };
}

export function openBrowser(url) {
  const [cmd, args] =
    platform() === 'darwin' ? ['open', [url]] : platform() === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

export const hasDisplay = () =>
  platform() === 'darwin' || platform() === 'win32' || Boolean(process.env.DISPLAY || process.env.WAYLAND_DISPLAY);

async function postForm(url, body, fetchImpl) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error_description || data.error || `HTTP ${res.status}`), { code: data.error, status: res.status });
  return data;
}

const withExpiry = (t, extra) => ({ ...extra, ...t, expires_at: Date.now() + (Number(t.expires_in) || 3600) * 1000 });

const PAGE = (title, body) =>
  `<!doctype html><meta charset="utf-8"><title>${title}</title><body style="font:16px system-ui;background:#f6f4ed;color:#16211d;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1 style="font:400 34px Georgia,serif">${title}</h1><p>${body}</p></div>`;

/* ----------------------------------------------------------------- login -- */

/**
 * @param {object} o
 * @param {string} o.issuer
 * @param {string} o.clientId
 * @param {object} [o.store]           createTokenStore(); tokens are saved when given
 * @param {string} [o.scope]
 * @param {boolean} [o.manual]         copy/paste flow instead of the loopback server
 * @param {string} [o.manualRedirectUri]  the server page that shows the code (manual mode)
 * @param {(url:string)=>any} [o.open]  how to open the browser (tests pass their own)
 * @param {(msg:string)=>void} [o.log]
 * @param {number} [o.timeoutMs]
 */
export async function login(o) {
  const fetchImpl = o.fetch ?? fetch;
  const log = o.log ?? ((m) => process.stderr.write(`${m}\n`));
  const meta = await discover(o.issuer, fetchImpl);
  const { verifier, challenge } = pkcePair();
  const state = b64url(randomBytes(16));
  const manual = o.manual ?? !hasDisplay();

  const authorizeUrl = (redirectUri) => {
    const u = new URL(meta.authorization_endpoint);
    u.search = new URLSearchParams({
      response_type: 'code',
      client_id: o.clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      ...(o.scope ? { scope: o.scope } : {}),
    }).toString();
    return u.toString();
  };

  let code;
  let redirectUri;
  if (manual) {
    redirectUri = o.manualRedirectUri ?? `${meta.issuer.replace(/\/+$/, '')}/oauth/cli`;
    const url = authorizeUrl(redirectUri);
    log(`Open this URL in any browser and approve:\n\n  ${url}\n`);
    const rl = createInterface({ input: o.input ?? process.stdin, output: process.stderr });
    const pasted = (await rl.question('Paste the code shown after you approve: ')).trim();
    rl.close();
    // Accept the bare code, or the whole "code#state" the server page shows.
    const [c, s] = pasted.split('#');
    if (s && s !== state) throw new Error('that code belongs to a different sign-in attempt');
    code = c;
  } else {
    const result = await new Promise((resolve, reject) => {
      const server = createServer((req, res) => {
        const u = new URL(req.url, 'http://127.0.0.1');
        if (u.pathname !== '/callback') {
          res.writeHead(404).end();
          return;
        }
        const err = u.searchParams.get('error');
        const ok = !err && u.searchParams.get('state') === state && u.searchParams.get('code');
        res.writeHead(ok ? 200 : 400, { 'content-type': 'text/html; charset=utf-8' });
        res.end(ok ? PAGE('Signed in', 'You can close this tab and go back to the terminal.') : PAGE('Sign-in failed', err ? `The request was ${err.replace(/_/g, ' ')}.` : 'This window did not come from your terminal.'));
        clearTimeout(timer);
        server.close();
        if (err) reject(new Error(`sign-in ${err.replace(/_/g, ' ')}`));
        else if (u.searchParams.get('state') !== state) reject(new Error('state mismatch: refusing the response'));
        else resolve({ code: u.searchParams.get('code') });
      });
      const timer = setTimeout(() => {
        server.close();
        reject(new Error('timed out waiting for the browser (5 minutes)'));
      }, o.timeoutMs ?? 300_000);
      server.listen(0, '127.0.0.1', () => {
        redirectUri = `http://127.0.0.1:${server.address().port}/callback`;
        const url = authorizeUrl(redirectUri);
        const opened = (o.open ?? openBrowser)(url);
        log(opened === false ? `Open this URL to sign in:\n\n  ${url}\n` : `Opening your browser to sign in…\nIf it did not open: ${url}`);
      });
    });
    code = result.code;
  }

  const tokens = await postForm(
    meta.token_endpoint,
    { grant_type: 'authorization_code', code, redirect_uri: redirectUri, client_id: o.clientId, code_verifier: verifier },
    fetchImpl,
  );
  const saved = withExpiry(tokens, { issuer: meta.issuer, client_id: o.clientId, token_endpoint: meta.token_endpoint, revocation_endpoint: meta.revocation_endpoint });
  if (o.store) await o.store.save(saved);
  return saved;
}

/** A valid access token, refreshed (and the rotated refresh token stored) when near expiry. */
export async function getAccessToken({ store, fetch: fetchImpl = fetch, skewMs = 60_000 } = {}) {
  const t = await store.load();
  if (!t?.access_token) return null;
  if (Date.now() < t.expires_at - skewMs) return t.access_token;
  if (!t.refresh_token) return null;
  try {
    const next = await postForm(t.token_endpoint, { grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: t.client_id }, fetchImpl);
    const saved = withExpiry(next, { issuer: t.issuer, client_id: t.client_id, token_endpoint: t.token_endpoint, revocation_endpoint: t.revocation_endpoint });
    await store.save(saved);
    return saved.access_token;
  } catch (err) {
    if (err.code === 'invalid_grant') await store.clear(); // revoked or reused: sign in again
    return null;
  }
}

/** Revoke the sign-in on the server (best effort) and forget it locally. */
export async function logout({ store, fetch: fetchImpl = fetch } = {}) {
  const t = await store.load();
  if (t?.revocation_endpoint && (t.refresh_token || t.access_token)) {
    await postForm(t.revocation_endpoint, { token: t.refresh_token ?? t.access_token, client_id: t.client_id }, fetchImpl).catch(() => {});
  }
  await store.clear();
  return Boolean(t);
}
