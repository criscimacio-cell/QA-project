import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';

const DB_PATH = path.join(__dirname, '../../data/qtamp.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      department TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      parent_id INTEGER REFERENCES repositories(id),
      type TEXT DEFAULT 'folder',
      project TEXT DEFAULT '',
      owner_id INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      original_name TEXT NOT NULL,
      path TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      mime_type TEXT DEFAULT '',
      repository_id INTEGER REFERENCES repositories(id),
      owner_id INTEGER REFERENCES users(id),
      version INTEGER DEFAULT 1,
      status TEXT DEFAULT 'draft',
      project TEXT DEFAULT '',
      module TEXT DEFAULT '',
      category TEXT DEFAULT '',
      jira_ticket TEXT DEFAULT '',
      tags TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS file_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER REFERENCES files(id),
      version INTEGER NOT NULL,
      path TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      change_log TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT DEFAULT '',
      category TEXT DEFAULT '',
      author_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'draft',
      tags TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      type TEXT DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT DEFAULT '',
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      entity_type TEXT DEFAULT '',
      entity_id INTEGER DEFAULT 0,
      details TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER REFERENCES files(id),
      reviewer_id INTEGER REFERENCES users(id),
      status TEXT DEFAULT 'pending',
      comments TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'file',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(name, type)
    );
  `);

  const existingCats = db.prepare('SELECT COUNT(*) as c FROM categories').get() as any;
  if (existingCats.c === 0) {
    const insertCat = db.prepare('INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)');
    ['Test Cases', 'RCA', 'Evidence', 'Test Plan', 'Test Data', 'Bug Report', 'Template', 'Test Scripts', 'Performance']
      .forEach(name => insertCat.run(name, 'file'));
    ['Troubleshooting', 'RCA', 'Testing Standards', 'Best Practices', 'Onboarding', 'Process Documentation']
      .forEach(name => insertCat.run(name, 'knowledge'));
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@qa.com');
  if (existingUser) return;

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, department, avatar) VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('QA Administrator', 'admin@qa.com',    hash('password123'), 'admin',    'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin');
  insertUser.run('QA Lead',          'lead@qa.com',     hash('password123'), 'lead',     'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lead');
  insertUser.run('QA Engineer 1',    'engineer1@qa.com',hash('password123'), 'engineer', 'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=eng1');
  insertUser.run('QA Engineer 2',    'engineer2@qa.com',hash('password123'), 'engineer', 'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=eng2');
  insertUser.run('Stakeholder',      'viewer@qa.com',   hash('password123'), 'viewer',   'Business',      'https://api.dicebear.com/7.x/avataaars/svg?seed=viewer');

  console.log('Database initialized with default accounts. No demo data seeded.');
}

export default db;
