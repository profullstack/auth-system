import { describe, expect, it, vi } from 'vitest';
import { AuthSystem, MemoryAdapter } from '../src/index.js';

/**
 * A used or revoked token must stay dead after a restart. The adapter outlives
 * the process (a database in production); a new AuthSystem over the same
 * adapter is what a deploy looks like.
 */
const boot = (adapter, send) =>
  new AuthSystem({
    adapter,
    tokenOptions: { secret: 'r'.repeat(32) },
    emailOptions: {
      sendEmail: send,
      fromEmail: 'n@test.com',
      verificationTemplate: { subject: 'v', text: '{{token}}', html: '{{token}}' },
      resetPasswordTemplate: { subject: 'r', text: '{{token}}', html: '{{token}}' },
    },
  });

describe('invalidation survives a restart', () => {
  it('a used verification link', async () => {
    const adapter = new MemoryAdapter();
    const send = vi.fn().mockResolvedValue(true);
    await boot(adapter, send).register({ email: 'v@example.com', password: 'Password123' });
    const token = send.mock.calls[0][0].text;
    await boot(adapter, send).verifyEmail(token);
    await expect(boot(adapter, send).verifyEmail(token)).rejects.toThrow(/invalid|expired/i);
  });

  it('a used reset link', async () => {
    const adapter = new MemoryAdapter();
    const send = vi.fn().mockResolvedValue(true);
    const a = boot(adapter, send);
    await a.register({ email: 'r@example.com', password: 'Password123', autoVerify: true });
    await a.resetPassword('r@example.com');
    const token = send.mock.calls.at(-1)[0].text;
    await boot(adapter, send).resetPasswordConfirm({ token, password: 'Password456' });
    await expect(boot(adapter, send).resetPasswordConfirm({ token, password: 'Password789' })).rejects.toThrow();
  });

  it('a logged-out refresh token', async () => {
    const adapter = new MemoryAdapter();
    const send = vi.fn().mockResolvedValue(true);
    const a = boot(adapter, send);
    await a.register({ email: 'l@example.com', password: 'Password123', autoVerify: true });
    const { tokens } = await a.login({ email: 'l@example.com', password: 'Password123' });
    await a.logout(tokens.refreshToken, tokens.accessToken);
    await expect(boot(adapter, send).refreshToken(tokens.refreshToken)).rejects.toThrow();
    expect(await boot(adapter, send).validateToken(tokens.accessToken)).toBeNull();
  });
});
