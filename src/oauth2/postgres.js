/**
 * Postgres storage for the OAuth 2.1 server, for the porsager `postgres` client
 * (tagged templates). Run OAUTH2_SCHEMA once (it is idempotent), e.g. as a
 * migration, then pass postgresStore(sql) to createOAuthServer.
 *
 * user_id is text, so it fits a uuid, an integer or a string id without a foreign
 * key into a users table this package does not own.
 */
export const OAUTH2_SCHEMA = `
create table if not exists oauth2_codes (
  code_hash       text primary key,
  user_id         text not null,
  client_id       text not null,
  redirect_uri    text not null,
  code_challenge  text not null,
  scope           text not null,
  expires_at      timestamptz not null,
  used_at         timestamptz
);
create table if not exists oauth2_tokens (
  token_hash  text primary key,
  kind        text not null check (kind in ('access', 'refresh')),
  user_id     text not null,
  client_id   text not null,
  scope       text not null,
  family_id   text not null,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists oauth2_tokens_family on oauth2_tokens (family_id);
create index if not exists oauth2_tokens_user on oauth2_tokens (user_id);
`;

export function postgresStore(sql) {
  const row = (r) =>
    r && {
      tokenHash: r.token_hash,
      kind: r.kind,
      userId: r.user_id,
      clientId: r.client_id,
      scope: r.scope,
      familyId: r.family_id,
      expiresAt: r.expires_at,
      used: Boolean(r.used_at),
      revoked: Boolean(r.revoked_at),
    };
  return {
    async saveCode(c) {
      await sql`
        insert into oauth2_codes (code_hash, user_id, client_id, redirect_uri, code_challenge, scope, expires_at)
        values (${c.codeHash}, ${String(c.userId)}, ${c.clientId}, ${c.redirectUri}, ${c.codeChallenge}, ${c.scope}, ${c.expiresAt})`;
    },
    async takeCode(codeHash) {
      const [r] = await sql`
        update oauth2_codes set used_at = now() where code_hash = ${codeHash} and used_at is null
        returning user_id, client_id, redirect_uri, code_challenge, scope, expires_at`;
      return r
        ? { userId: r.user_id, clientId: r.client_id, redirectUri: r.redirect_uri, codeChallenge: r.code_challenge, scope: r.scope, expiresAt: r.expires_at }
        : null;
    },
    async saveToken(t) {
      await sql`
        insert into oauth2_tokens (token_hash, kind, user_id, client_id, scope, family_id, expires_at)
        values (${t.tokenHash}, ${t.kind}, ${String(t.userId)}, ${t.clientId}, ${t.scope}, ${t.familyId}, ${t.expiresAt})`;
    },
    async getToken(tokenHash) {
      const [r] = await sql`select * from oauth2_tokens where token_hash = ${tokenHash}`;
      return row(r) ?? null;
    },
    async markUsed(tokenHash) {
      const r = await sql`
        update oauth2_tokens set used_at = now()
        where token_hash = ${tokenHash} and used_at is null and revoked_at is null returning token_hash`;
      return r.length === 1;
    },
    async revokeFamily(familyId) {
      await sql`update oauth2_tokens set revoked_at = now() where family_id = ${familyId} and revoked_at is null`;
    },
  };
}
