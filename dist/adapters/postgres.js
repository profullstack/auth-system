/**
 * PostgreSQL Adapter for Auth System
 *
 * Users and invalidated tokens in Postgres, with the same behaviour as the
 * memory adapter so the two are interchangeable.
 *
 * The `pg` package is a peer, not a dependency: this module is used by projects
 * that never touch Postgres, and a driver they cannot use is a driver they
 * should not install. Pass a pool in, or let the adapter make one.
 *
 *   import pg from 'pg';
 *   const adapter = new PostgresAdapter({
 *     pool: new pg.Pool({ connectionString: process.env.DATABASE_URL }),
 *   });
 *   await adapter.initialize();   // creates the tables if they are missing
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * A row as the rest of the auth system expects it.
 *
 * Postgres hands back lower-case column names and Date objects; the memory
 * adapter deals in camelCase and ISO strings, and everything above the adapter
 * is written against that shape.
 */
function toUser(row) {
  if (!row) {
    return null;
  }
  const iso = (value) => (value instanceof Date ? value.toISOString() : value ?? null);
  return {
    id: row.id,
    email: row.email,
    password: row.password,
    profile: row.profile ?? {},
    emailVerified: row.email_verified ?? false,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    lastLoginAt: iso(row.last_login_at),
  };
}

/** Fields a caller may set. The column for each is derived, not spelled out. */
const UPDATABLE = ['email', 'password', 'emailVerified', 'lastLoginAt'];

/** emailVerified -> email_verified. */
function columnFor(field) {
  return field.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export class PostgresAdapter {
  /**
   * @param {Object} options
   * @param {Object} [options.pool] - A pg Pool. Made from the rest if absent.
   * @param {string} [options.connectionString]
   * @param {string} [options.host]
   * @param {number} [options.port]
   * @param {string} [options.database]
   * @param {string} [options.user]
   * @param {string} [options.password]
   * @param {string} [options.usersTable] - Default 'users'.
   * @param {string} [options.tokensTable] - Default 'invalidated_tokens'.
   */
  constructor(options = {}) {
    this.options = options;
    // Identifiers cannot be parameterised, so they are restricted rather than
    // quoted: a table name is configuration, but it still reaches SQL as text.
    this.usersTable = safeIdentifier(options.usersTable || 'users');
    this.tokensTable = safeIdentifier(options.tokensTable || 'invalidated_tokens');
    this.pool = options.pool ?? null;
    this.ready = false;
    this.sql = statements(this.usersTable, this.tokensTable);
  }

  /** The pool, made on first use when one was not supplied. */
  async getPool() {
    if (this.pool) {
      return this.pool;
    }
    let pg;
    try {
      pg = (await import('pg')).default;
    } catch {
      throw new Error(
        'PostgresAdapter needs the `pg` package, or a `pool` passed to its constructor.'
      );
    }
    const { connectionString, host, port, database, user, password } = this.options;
    this.pool = new pg.Pool(
      connectionString ? { connectionString } : { host, port, database, user, password }
    );
    return this.pool;
  }

  async query(text, values = []) {
    const pool = await this.getPool();
    return pool.query(text, values);
  }

  /**
   * Create the tables if they are not there. Safe to call on every boot, and
   * cheaper than asking every project to carry a migration for two tables.
   */
  async initialize() {
    if (this.ready) {
      return;
    }
    await this.query(this.sql.createUsers);
    // Addresses are matched case-insensitively everywhere else, so uniqueness
    // has to be case-insensitive too, or two accounts can share an address.
    await this.query(this.sql.createEmailIndex);
    await this.query(this.sql.createTokens);
    this.ready = true;
  }

  async createUser(userData) {
    await this.initialize();
    const id = userData.id || uuidv4();
    const now = new Date().toISOString();

    const { rows } = await this.query(this.sql.insertUser, [
        id,
        userData.email,
        userData.password ?? null,
        JSON.stringify(userData.profile || {}),
        userData.emailVerified || false,
        userData.createdAt || now,
        userData.updatedAt || now,
      ]
    );
    return toUser(rows[0]);
  }

  async getUserById(userId) {
    await this.initialize();
    const { rows } = await this.query(this.sql.selectById, [userId]);
    return toUser(rows[0]);
  }

  async getUserByEmail(email) {
    await this.initialize();
    const { rows } = await this.query(this.sql.selectByEmail, [email]);
    return toUser(rows[0]);
  }

  async updateUser(userId, updates) {
    await this.initialize();

    const sets = [];
    const values = [];
    for (const field of UPDATABLE) {
      if (updates[field] !== undefined) {
        values.push(updates[field]);
        sets.push(`${columnFor(field)} = $${values.length}`);
      }
    }
    // A profile is merged rather than replaced, matching the memory adapter:
    // updating one field of it must not drop the others.
    if (updates.profile !== undefined) {
      values.push(JSON.stringify(updates.profile));
      sets.push(`profile = profile || $${values.length}::jsonb`);
    }
    values.push(new Date().toISOString());
    sets.push(`updated_at = $${values.length}`);

    values.push(userId);
    const { rows } = await this.query(this.sql.updateUser(sets, values.length), values);
    if (!rows[0]) {
      throw new Error('User not found');
    }
    return toUser(rows[0]);
  }

  async deleteUser(userId) {
    await this.initialize();
    const { rowCount } = await this.query(this.sql.deleteUser, [userId]);
    return rowCount > 0;
  }

  async invalidateToken(token) {
    await this.initialize();
    // Invalidating twice is not an error: a client that retries a logout has
    // done nothing wrong.
    await this.query(this.sql.insertToken, [token]);
  }

  async isTokenInvalidated(token) {
    await this.initialize();
    const { rows } = await this.query(this.sql.selectToken, [token]);
    return rows.length > 0;
  }

  /** Empty both tables. For tests. */
  async clear() {
    await this.initialize();
    await this.query(this.sql.clearUsers);
    await this.query(this.sql.clearTokens);
  }

  /** Let go of the pool, so a process can exit. */
  async close() {
    await this.pool?.end?.();
    this.pool = null;
    this.ready = false;
  }
}

/**
 * Every statement, built once from names that have already been checked.
 *
 * This is the only place a table name reaches SQL. Values are never
 * interpolated anywhere -- they are bound as $1, $2 and so on -- so a reader
 * has one function to satisfy themselves about rather than nine call sites.
 */
function statements(users, tokens) {
  return {
    createUsers: `
      CREATE TABLE IF NOT EXISTS ${users} (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        password TEXT,
        profile JSONB NOT NULL DEFAULT '{}'::jsonb,
        email_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_login_at TIMESTAMPTZ
      )`,
    createEmailIndex: `
      CREATE UNIQUE INDEX IF NOT EXISTS ${users}_email_lower_idx
        ON ${users} (lower(email))`,
    createTokens: `
      CREATE TABLE IF NOT EXISTS ${tokens} (
        token TEXT PRIMARY KEY,
        invalidated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )`,
    insertUser: `
      INSERT INTO ${users}
        (id, email, password, profile, email_verified, created_at, updated_at, last_login_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
      RETURNING *`,
    selectById: `SELECT * FROM ${users} WHERE id = $1`,
    selectByEmail: `SELECT * FROM ${users} WHERE lower(email) = lower($1)`,
    deleteUser: `DELETE FROM ${users} WHERE id = $1`,
    insertToken: `INSERT INTO ${tokens} (token) VALUES ($1) ON CONFLICT (token) DO NOTHING`,
    selectToken: `SELECT 1 FROM ${tokens} WHERE token = $1`,
    clearUsers: `DELETE FROM ${users}`,
    clearTokens: `DELETE FROM ${tokens}`,
    /**
     * The one statement whose shape depends on the call: only the columns the
     * caller actually set are written. The fragments come from a fixed list of
     * field names, never from the caller's own strings.
     */
    updateUser: (sets, idAt) => `UPDATE ${users} SET ${sets.join(', ')} WHERE id = $${idAt} RETURNING *`,
  };
}

/**
 * A table name that can be interpolated. Identifiers cannot be bound as
 * parameters, so anything that is not a plain name is refused rather than
 * escaped and hoped over.
 */
function safeIdentifier(name) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error(`PostgresAdapter: unsafe table name ${JSON.stringify(name)}`);
  }
  return name;
}

export default PostgresAdapter;
