/**
 * The Postgres adapter, against a fake pool.
 *
 * A real database would be a better test and a worse one to run: this asserts
 * the SQL and the shape it returns, which is where the adapter can actually be
 * wrong. The behaviour it has to match is the memory adapter's.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PostgresAdapter } from '../../src/adapters/postgres.js';

/** A pool that records what it was asked and answers what it was told to. */
function fakePool(answers = []) {
  const calls = [];
  let at = 0;
  return {
    calls,
    async query(text, values) {
      calls.push({ text: text.replace(/\s+/g, ' ').trim(), values });
      const answer = answers[at++];
      return answer ?? { rows: [], rowCount: 0 };
    },
    async end() {},
  };
}

const row = (over = {}) => ({
  id: 'u1',
  email: 'Someone@Example.com',
  password: 'hashed',
  profile: { name: 'Someone' },
  email_verified: false,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-02T00:00:00Z'),
  last_login_at: null,
  ...over,
});

describe('PostgresAdapter', () => {
  let pool;
  let adapter;

  beforeEach(() => {
    pool = fakePool();
    adapter = new PostgresAdapter({ pool });
  });

  it('creates its tables once, however many calls are made', async () => {
    await adapter.initialize();
    const first = pool.calls.length;
    expect(first).toBeGreaterThan(0);
    await adapter.initialize();
    expect(pool.calls.length).toBe(first);

    const ddl = pool.calls.map((c) => c.text).join(' ');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS invalidated_tokens');
    // Addresses are matched case-insensitively, so uniqueness must be too, or
    // two accounts can share one address.
    expect(ddl).toContain('lower(email)');
  });

  it('refuses a table name that cannot be interpolated safely', () => {
    expect(() => new PostgresAdapter({ pool, usersTable: 'users; DROP TABLE x' })).toThrow(
      /unsafe table name/
    );
    expect(() => new PostgresAdapter({ pool, usersTable: 'my_users' })).not.toThrow();
  });

  it('returns a user in the shape everything above it expects', async () => {
    pool = fakePool([{}, {}, {}, { rows: [row()] }]);
    adapter = new PostgresAdapter({ pool });

    const user = await adapter.getUserById('u1');
    expect(user).toEqual({
      id: 'u1',
      email: 'Someone@Example.com',
      password: 'hashed',
      profile: { name: 'Someone' },
      emailVerified: false,
      // Dates come back as Date objects and have to leave as ISO strings, the
      // way the memory adapter's do.
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      lastLoginAt: null,
    });
  });

  it('answers null for a user who is not there', async () => {
    expect(await adapter.getUserById('nobody')).toBe(null);
    expect(await adapter.getUserByEmail('nobody@example.com')).toBe(null);
  });

  it('matches an address whatever its case', async () => {
    await adapter.getUserByEmail('SOMEONE@example.com');
    const select = pool.calls.at(-1);
    expect(select.text).toContain('lower(email) = lower($1)');
    expect(select.values).toEqual(['SOMEONE@example.com']);
  });

  it('creates a user with an id when none was given', async () => {
    pool = fakePool([{}, {}, {}, { rows: [row()] }]);
    adapter = new PostgresAdapter({ pool });

    await adapter.createUser({ email: 'someone@example.com', password: 'hashed' });
    const insert = pool.calls.at(-1);
    expect(insert.text).toContain('INSERT INTO users');
    expect(insert.values[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(insert.values[1]).toBe('someone@example.com');
    // A profile is stored as JSON, not as [object Object].
    expect(insert.values[3]).toBe('{}');
  });

  it('merges a profile rather than replacing it', async () => {
    pool = fakePool([{}, {}, {}, { rows: [row()] }]);
    adapter = new PostgresAdapter({ pool });

    await adapter.updateUser('u1', { profile: { name: 'New' } });
    const update = pool.calls.at(-1);
    // Updating one field of a profile must not drop the others, which is what
    // the memory adapter does.
    expect(update.text).toContain('profile = profile || ');
    expect(update.text).toContain('::jsonb');
  });

  it('only updates the columns it was given', async () => {
    pool = fakePool([{}, {}, {}, { rows: [row()] }]);
    adapter = new PostgresAdapter({ pool });

    await adapter.updateUser('u1', { emailVerified: true });
    const update = pool.calls.at(-1);
    expect(update.text).toContain('email_verified = $1');
    expect(update.text).not.toContain('password =');
    // updated_at is always set, and the id is always last.
    expect(update.text).toContain('updated_at = $2');
    expect(update.values.at(-1)).toBe('u1');
  });

  it('throws when updating somebody who is not there', async () => {
    pool = fakePool([{}, {}, {}, { rows: [] }]);
    adapter = new PostgresAdapter({ pool });
    await expect(adapter.updateUser('nobody', { emailVerified: true })).rejects.toThrow(
      'User not found'
    );
  });

  it('says whether a delete removed anything', async () => {
    pool = fakePool([{}, {}, {}, { rowCount: 1 }]);
    adapter = new PostgresAdapter({ pool });
    expect(await adapter.deleteUser('u1')).toBe(true);

    pool = fakePool([{}, {}, {}, { rowCount: 0 }]);
    adapter = new PostgresAdapter({ pool });
    expect(await adapter.deleteUser('nobody')).toBe(false);
  });

  it('invalidating a token twice is not an error', async () => {
    await adapter.invalidateToken('t1');
    const insert = pool.calls.at(-1);
    // A client that retries a logout has done nothing wrong.
    expect(insert.text).toContain('ON CONFLICT (token) DO NOTHING');
  });

  it('reports an invalidated token, and only that', async () => {
    pool = fakePool([{}, {}, {}, { rows: [{ '?column?': 1 }] }]);
    adapter = new PostgresAdapter({ pool });
    expect(await adapter.isTokenInvalidated('t1')).toBe(true);

    pool = fakePool([{}, {}, {}, { rows: [] }]);
    adapter = new PostgresAdapter({ pool });
    expect(await adapter.isTokenInvalidated('t2')).toBe(false);
  });

  it('uses the pool it was given, and never reaches for pg', async () => {
    // pg is a peer: projects that never touch Postgres should not install a
    // driver they cannot use, and one that hands in a pool needs no driver
    // lookup at all.
    expect(await adapter.getPool()).toBe(pool);
  });

  it('says what is missing when it cannot make a pool', async () => {
    const bare = new PostgresAdapter({ connectionString: 'postgres://nowhere' });
    // Whether pg resolves depends on the host project, so this asserts the
    // failure is explained rather than that it happens.
    try {
      const made = await bare.getPool();
      expect(made).toBeTruthy();
      await bare.close();
    } catch (error) {
      expect(error.message).toMatch(/needs the `pg` package/);
    }
  });
});
