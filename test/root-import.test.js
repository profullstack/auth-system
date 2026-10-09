import { describe, expect, it } from 'vitest';

describe('the root export', () => {
  it('loads without any optional database driver installed', async () => {
    const mod = await import('../src/index.js');
    expect(typeof mod.AuthSystem).toBe('function');
    expect(typeof mod.SupabaseAdapter).toBe('function');
  });
  it('builds a Supabase adapter without touching the driver', async () => {
    const { SupabaseAdapter } = await import('../src/index.js');
    const fake = { from: () => ({}) };
    const a = new SupabaseAdapter({ supabaseUrl: 'https://x.supabase.co', supabaseKey: 'k', client: fake });
    expect(await a.client()).toBe(fake);
  });
});

describe('a password change', () => {
  it('does not reject a token issued in the same second, after the change', async () => {
    const { AuthSystem, MemoryAdapter } = await import('../src/index.js');
    const sys = new AuthSystem({ adapter: new MemoryAdapter(), tokenOptions: { secret: 's'.repeat(32) } });
    await sys.register({ email: 'p@example.com', password: 'Password123', autoVerify: true });
    const first = await sys.login({ email: 'p@example.com', password: 'Password123' });
    await sys.changePassword({ userId: first.user.id, currentPassword: 'Password123', newPassword: 'Password456' });
    const fresh = await sys.login({ email: 'p@example.com', password: 'Password456' });
    expect(await sys.validateToken(fresh.tokens.accessToken)).not.toBeNull();
  });
});
