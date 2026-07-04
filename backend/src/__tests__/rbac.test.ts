import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../app';
import sql from '../db';

async function loginAs(email: string, password = 'password123'): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  return (res.headers['set-cookie'] as unknown as string[]).join('; ');
}

describe('RBAC — built-in roles', () => {
  it('blocks a viewer from uploading a file', async () => {
    const cookie = await loginAs('viewer@qa.com');
    const res = await request(app)
      .post('/api/files/upload')
      .set('Cookie', cookie)
      .attach('file', Buffer.from('hello world'), 'test.txt');
    expect(res.status).toBe(403);
  });

  it('allows a viewer to list files', async () => {
    const cookie = await loginAs('viewer@qa.com');
    const res = await request(app).get('/api/files').set('Cookie', cookie);
    expect(res.status).toBe(200);
  });

  it('blocks an engineer from deleting a user', async () => {
    const engineerCookie = await loginAs('engineer1@qa.com');
    const [target] = await sql`SELECT id FROM users WHERE email = 'viewer@qa.com'`;
    const res = await request(app).delete(`/api/users/${target.id}`).set('Cookie', engineerCookie);
    expect(res.status).toBe(403);
  });

  it('blocks an engineer from approving a file (lead-only)', async () => {
    const engineerCookie = await loginAs('engineer1@qa.com');
    const upload = await request(app)
      .post('/api/files/upload')
      .set('Cookie', engineerCookie)
      .attach('file', Buffer.from('hello world'), 'approve-me.txt')
      .field('project', 'Test');
    expect(upload.status).toBe(200);

    const res = await request(app).post(`/api/files/${upload.body.id}/approve`).set('Cookie', engineerCookie).send({});
    expect(res.status).toBe(403);
  });

  it('allows a lead to approve a submitted file', async () => {
    const engineerCookie = await loginAs('engineer1@qa.com');
    const leadCookie = await loginAs('lead@qa.com');

    const upload = await request(app)
      .post('/api/files/upload')
      .set('Cookie', engineerCookie)
      .attach('file', Buffer.from('hello world'), 'lead-approve.txt')
      .field('project', 'Test');
    expect(upload.status).toBe(200);
    await request(app).post(`/api/files/${upload.body.id}/submit`).set('Cookie', engineerCookie).send({}).expect(200);

    const res = await request(app).post(`/api/files/${upload.body.id}/approve`).set('Cookie', leadCookie).send({ status: 'approved' });
    expect(res.status).toBe(200);
  });

  it('lets admin bypass a role check a lead would fail (deleting a user)', async () => {
    const adminCookie = await loginAs('admin@qa.com');
    const [target] = await sql`
      INSERT INTO users (name, email, password_hash, role, organization_id) VALUES ('Throwaway', 'throwaway@qa.com', 'x', 'viewer', 1) RETURNING id
    `;
    const res = await request(app).delete(`/api/users/${target.id}`).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
  });
});

describe('RBAC — custom roles via org role_permissions', () => {
  beforeAll(async () => {
    // dashboard.ts's /stats route has no requireModule gate, and files.ts's
    // GET / (list) has none either — both would pass regardless of this
    // role's permissions, so they can't distinguish "gate working" from "no
    // gate at all". bulk-download (files, no requireRole after it) and
    // knowledge creation (knowledge module) each have a requireModule-only
    // gate, which is what's actually being tested here.
    await sql`
      UPDATE organizations SET role_permissions = ${sql.json({
        qa_analyst: { files: true, knowledge: false, __moduleCleared: true },
      })}
      WHERE id = 1
    `;
    const passwordHash = await bcrypt.hash('password123', 10);
    await sql`
      INSERT INTO users (name, email, password_hash, role, organization_id)
      VALUES ('Custom Role User', 'qa_analyst@qa.com', ${passwordHash}, 'qa_analyst', 1)
    `;
  });

  it('lets a custom role through a module it has been granted', async () => {
    const cookie = await loginAs('qa_analyst@qa.com');
    const res = await request(app).post('/api/files/bulk-download').set('Cookie', cookie).send({ fileIds: [] });
    expect(res.status).not.toBe(403);
  });

  it('blocks a custom role from a module it has not been granted', async () => {
    const cookie = await loginAs('qa_analyst@qa.com');
    const res = await request(app).post('/api/knowledge').set('Cookie', cookie).send({ title: 'x', content: 'y' });
    expect(res.status).toBe(403);
  });
});
