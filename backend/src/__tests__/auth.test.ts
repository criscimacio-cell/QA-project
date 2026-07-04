import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';
import sql from '../db';

const ADMIN = { email: 'admin@qa.com', password: 'password123' };

function cookieValue(setCookieHeader: string[] | undefined, name: string): string | undefined {
  const line = setCookieHeader?.find((c) => c.startsWith(`${name}=`));
  return line?.split(';')[0].split('=')[1];
}

describe('POST /api/auth/login', () => {
  it('rejects a wrong password with 401 and no cookies', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: 'wrong-password' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('accepts correct demo credentials and sets httpOnly session cookies', async () => {
    const res = await request(app).post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(ADMIN.email);
    expect(res.body.user.password_hash).toBeUndefined();
    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(cookieValue(setCookie, 'accessToken')).toBeTruthy();
    expect(cookieValue(setCookie, 'refreshToken')).toBeTruthy();
    expect(setCookie.every((c) => c.includes('HttpOnly'))).toBe(true);
  });

  it('locks out further attempts after repeated failures from the same IP', async () => {
    for (let i = 0; i < 20; i++) {
      await request(app).post('/api/auth/login').send({ email: `nobody-${i}@qa.com`, password: 'wrong' });
    }
    const res = await request(app).post('/api/auth/login').send({ email: 'yet-another@qa.com', password: 'wrong' });
    expect(res.status).toBe(429);
    // The rate limit is IP-scoped for 15 minutes with no per-test reset —
    // clear it so later tests in this file (all from the same loopback IP)
    // aren't collateral damage from this test's deliberate lockout.
    await sql`DELETE FROM audit_logs WHERE action = 'LOGIN_FAIL'`;
  });
});

describe('POST /api/auth/refresh', () => {
  it('rotates the refresh token and revokes the old one', async () => {
    const login = await request(app).post('/api/auth/login').send(ADMIN);
    const cookieHeader = (login.headers['set-cookie'] as unknown as string[]).join('; ');

    const refreshed = await request(app).post('/api/auth/refresh').set('Cookie', cookieHeader);
    expect(refreshed.status).toBe(200);
    const newCookieHeader = (refreshed.headers['set-cookie'] as unknown as string[]).join('; ');
    expect(newCookieHeader).not.toContain(cookieValue(login.headers['set-cookie'] as unknown as string[], 'refreshToken')!);

    // The original (now-revoked) refresh token must not work a second time.
    const reused = await request(app).post('/api/auth/refresh').set('Cookie', cookieHeader);
    expect(reused.status).toBe(401);
  });

  it('rejects a session past the absolute lifetime cap and clears cookies', async () => {
    const login = await request(app).post('/api/auth/login').send(ADMIN);
    const cookieHeader = (login.headers['set-cookie'] as unknown as string[]).join('; ');
    const refreshToken = cookieValue(login.headers['set-cookie'] as unknown as string[], 'refreshToken');

    await sql`UPDATE refresh_tokens SET first_issued_at = NOW() - INTERVAL '31 days' WHERE token = ${refreshToken!}`;

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookieHeader);
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/session expired/i);
    const clearedCookies = (res.headers['set-cookie'] as unknown as string[]).join('; ');
    expect(clearedCookies).toContain('accessToken=;');
  });

  it('carries the original first_issued_at forward across a normal rotation', async () => {
    const login = await request(app).post('/api/auth/login').send(ADMIN);
    const cookieHeader = (login.headers['set-cookie'] as unknown as string[]).join('; ');
    const refreshToken = cookieValue(login.headers['set-cookie'] as unknown as string[], 'refreshToken');
    const [before] = await sql`SELECT first_issued_at FROM refresh_tokens WHERE token = ${refreshToken!}`;

    await request(app).post('/api/auth/refresh').set('Cookie', cookieHeader).expect(200);

    const [after] = await sql`
      SELECT first_issued_at FROM refresh_tokens
      WHERE user_id = (SELECT id FROM users WHERE email = ${ADMIN.email}) AND revoked = FALSE
      ORDER BY id DESC LIMIT 1
    `;
    expect(new Date(after.first_issued_at).getTime()).toBe(new Date(before.first_issued_at).getTime());
  });
});

describe('POST /api/auth/logout', () => {
  it('revokes the refresh token so it can no longer be used', async () => {
    const login = await request(app).post('/api/auth/login').send(ADMIN);
    const cookieHeader = (login.headers['set-cookie'] as unknown as string[]).join('; ');

    await request(app).post('/api/auth/logout').set('Cookie', cookieHeader).expect(200);

    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookieHeader);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/change-password', () => {
  it('rejects the wrong current password', async () => {
    const login = await request(app).post('/api/auth/login').send(ADMIN);
    const cookieHeader = (login.headers['set-cookie'] as unknown as string[]).join('; ');

    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieHeader)
      .send({ currentPassword: 'not-the-real-password', newPassword: 'brandNewPassw0rd' });
    expect(res.status).toBe(400);
  });

  it('changes the password and the old one stops working', async () => {
    const login = await request(app).post('/api/auth/login').send(ADMIN);
    const cookieHeader = (login.headers['set-cookie'] as unknown as string[]).join('; ');

    await request(app)
      .post('/api/auth/change-password')
      .set('Cookie', cookieHeader)
      .send({ currentPassword: ADMIN.password, newPassword: 'brandNewPassw0rd1' })
      .expect(200);

    const oldStillWorks = await request(app).post('/api/auth/login').send(ADMIN);
    expect(oldStillWorks.status).toBe(401);

    const newWorks = await request(app).post('/api/auth/login').send({ email: ADMIN.email, password: 'brandNewPassw0rd1' });
    expect(newWorks.status).toBe(200);
  });
});
