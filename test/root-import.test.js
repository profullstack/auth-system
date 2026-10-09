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
