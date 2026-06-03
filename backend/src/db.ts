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
  `);

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@qa.com');
  if (existingUser) return;

  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, department, avatar) VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertUser.run('QA Administrator', 'admin@qa.com', hash('password123'), 'admin', 'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin');
  insertUser.run('QA Lead - Maria Santos', 'lead@qa.com', hash('password123'), 'lead', 'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lead');
  insertUser.run('John Cruz - QA Engineer', 'engineer1@qa.com', hash('password123'), 'engineer', 'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=eng1');
  insertUser.run('Anna Reyes - QA Engineer', 'engineer2@qa.com', hash('password123'), 'engineer', 'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=eng2');
  insertUser.run('Stakeholder Viewer', 'viewer@qa.com', hash('password123'), 'viewer', 'Business', 'https://api.dicebear.com/7.x/avataaars/svg?seed=viewer');

  const insertRepo = db.prepare(`
    INSERT INTO repositories (name, description, parent_id, type, project, owner_id) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const root = insertRepo.run('QA Repository', 'Main QA repository for all test assets', null, 'repo', 'All', 1);
  const philhealth = insertRepo.run('PhilHealth', 'PhilHealth system test assets', root.lastInsertRowid, 'folder', 'PhilHealth', 2);
  insertRepo.run('CF4', 'CF4 module test cases and assets', philhealth.lastInsertRowid, 'folder', 'PhilHealth', 2);
  insertRepo.run('CF5', 'CF5 module test cases and assets', philhealth.lastInsertRowid, 'folder', 'PhilHealth', 2);
  insertRepo.run('XML Validation', 'XML validation test files', philhealth.lastInsertRowid, 'folder', 'PhilHealth', 2);
  const interim = insertRepo.run('Interim', 'Interim project assets', root.lastInsertRowid, 'folder', 'Interim', 2);
  insertRepo.run('API Testing', 'API test scripts and payloads', interim.lastInsertRowid, 'folder', 'Interim', 3);
  insertRepo.run('UI Testing', 'UI test cases and screenshots', interim.lastInsertRowid, 'folder', 'Interim', 3);
  const etl = insertRepo.run('ETL', 'ETL process test files', root.lastInsertRowid, 'folder', 'ETL', 2);
  insertRepo.run('Templates', 'ETL template files', etl.lastInsertRowid, 'folder', 'ETL', 3);
  insertRepo.run('Sample Files', 'Sample data files for ETL', etl.lastInsertRowid, 'folder', 'ETL', 3);
  const automation = insertRepo.run('Automation', 'Test automation scripts', root.lastInsertRowid, 'folder', 'Automation', 2);
  insertRepo.run('Playwright', 'Playwright automation tests', automation.lastInsertRowid, 'folder', 'Automation', 3);
  insertRepo.run('Cypress', 'Cypress automation tests', automation.lastInsertRowid, 'folder', 'Automation', 3);
  insertRepo.run('Knowledge Base', 'QA knowledge articles and guides', root.lastInsertRowid, 'folder', 'All', 2);

  const insertFile = db.prepare(`
    INSERT INTO files (name, original_name, size, mime_type, repository_id, owner_id, version, status, project, module, category, jira_ticket, tags, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const cf4RepoId = (db.prepare("SELECT id FROM repositories WHERE name='CF4'").get() as any).id;
  const cf5RepoId = (db.prepare("SELECT id FROM repositories WHERE name='CF5'").get() as any).id;
  const apiRepoId = (db.prepare("SELECT id FROM repositories WHERE name='API Testing'").get() as any).id;
  const etlTemplatesId = (db.prepare("SELECT id FROM repositories WHERE name='Templates'").get() as any).id;
  const playwrightId = (db.prepare("SELECT id FROM repositories WHERE name='Playwright'").get() as any).id;

  insertFile.run('CF4 Pemisc Test Cases v4', 'CF4_Pemisc_TestCases_v4.xlsx', 245760, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', cf4RepoId, 3, 4, 'published', 'PhilHealth', 'CF4', 'Test Cases', 'QA-123', 'CF4,Pemisc,TestCases', 'Comprehensive test cases for CF4 Pemisc module');
  insertFile.run('CF4 RCA Report - June 2025', 'CF4_RCA_June2025.pdf', 512000, 'application/pdf', cf4RepoId, 3, 2, 'approved', 'PhilHealth', 'CF4', 'RCA', 'QA-145', 'CF4,RCA,2025', 'Root cause analysis for CF4 defects in June 2025');
  insertFile.run('CF4 Evidence Screenshots', 'CF4_Evidence_Screenshots.zip', 1048576, 'application/zip', cf4RepoId, 4, 1, 'published', 'PhilHealth', 'CF4', 'Evidence', 'QA-156', 'CF4,Screenshots,Evidence', 'Test execution evidence for CF4 sprint');
  insertFile.run('CF5 Test Plan v2', 'CF5_TestPlan_v2.docx', 184320, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', cf5RepoId, 2, 2, 'approved', 'PhilHealth', 'CF5', 'Test Plan', 'QA-167', 'CF5,TestPlan', 'Test plan for CF5 implementation phase 2');
  insertFile.run('CF5 Sample JSON Payload', 'CF5_sample_payload.json', 8192, 'application/json', cf5RepoId, 3, 3, 'published', 'PhilHealth', 'CF5', 'Test Data', 'QA-178', 'CF5,JSON,Payload,Sample', 'Valid CF5 JSON payload for integration testing');
  insertFile.run('CF5 XML Schema Validation', 'CF5_schema.xml', 16384, 'application/xml', cf5RepoId, 3, 1, 'under_review', 'PhilHealth', 'CF5', 'Test Data', 'QA-189', 'CF5,XML,Schema', 'XML schema for CF5 validation testing');
  insertFile.run('Interim API Test Collection', 'Interim_API_Tests.json', 32768, 'application/json', apiRepoId, 3, 5, 'published', 'Interim', 'API', 'Test Scripts', 'QA-200', 'Interim,API,Postman', 'Postman collection for Interim API endpoints');
  insertFile.run('ETL Template - Claims Processing', 'ETL_Claims_Template.xlsx', 98304, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', etlTemplatesId, 4, 1, 'published', 'ETL', 'Claims', 'Template', 'QA-211', 'ETL,Claims,Template', 'Standard ETL template for claims processing');
  insertFile.run('Playwright E2E Test Suite', 'playwright_e2e.spec.ts', 45056, 'text/typescript', playwrightId, 3, 2, 'approved', 'Automation', 'E2E', 'Test Scripts', 'QA-222', 'Playwright,E2E,Automation', 'End-to-end test suite using Playwright');
  insertFile.run('CF4 Pemisc Bug Report', 'CF4_Pemisc_Bugs.xlsx', 73728, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', cf4RepoId, 3, 1, 'submitted', 'PhilHealth', 'CF4', 'Bug Report', 'QA-233', 'CF4,Pemisc,Bugs', 'Bug tracker for CF4 Pemisc issues');
  insertFile.run('CF4 Performance Test Results', 'CF4_Performance.pdf', 204800, 'application/pdf', cf4RepoId, 2, 1, 'draft', 'PhilHealth', 'CF4', 'Performance', 'QA-244', 'CF4,Performance', 'Performance test results for CF4');
  insertFile.run('XML Validation Test Data', 'XML_Validation_Data.zip', 2097152, 'application/zip', (db.prepare("SELECT id FROM repositories WHERE name='XML Validation'").get() as any).id, 3, 1, 'published', 'PhilHealth', 'XML', 'Test Data', 'QA-255', 'XML,Validation,PhilHealth', 'Test data set for XML validation');

  // Seed file versions for the seeded files
  const insertVersion = db.prepare(`
    INSERT INTO file_versions (file_id, version, path, size, change_log, created_by) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const seededFiles = db.prepare('SELECT id, version, size FROM files').all() as any[];
  for (const f of seededFiles) {
    for (let v = 1; v <= f.version; v++) {
      insertVersion.run(f.id, v, '', f.size, v === 1 ? 'Initial upload' : `Version ${v} update`, v === 1 ? 3 : 2);
    }
  }

  const insertArticle = db.prepare(`
    INSERT INTO knowledge_articles (title, content, category, author_id, status, tags)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertArticle.run('CF4 Pemisc - Common Issues & Resolutions', '<h2>CF4 Pemisc Known Issues</h2><p>This article documents recurring issues in the CF4 Pemisc module and their resolutions.</p><h3>Issue 1: XML Parsing Error</h3><p>When processing XML with special characters, ensure proper encoding is applied.</p><p><strong>Resolution:</strong> Use UTF-8 encoding and escape special characters before submission.</p><h3>Issue 2: Duplicate Claims</h3><p>Duplicate claim submissions can occur when the batch process retries.</p><p><strong>Resolution:</strong> Implement idempotency check using claim reference number.</p>', 'Troubleshooting', 2, 'published', 'CF4,Pemisc,Troubleshooting');
  insertArticle.run('QA Onboarding Guide - New Team Members', '<h2>Welcome to the QA Team!</h2><p>This guide will help you get started with our QA processes and tools.</p><h3>Step 1: Environment Setup</h3><p>Install required tools: VS Code, Playwright, Postman, JIRA access.</p><h3>Step 2: Understanding Our Workflow</h3><p>We follow a structured testing workflow: Plan → Design → Execute → Report.</p>', 'Onboarding', 2, 'published', 'Onboarding,Guide,NewMember');
  insertArticle.run('ETL Testing Best Practices', '<h2>ETL Testing Standards</h2><p>Guidelines for testing ETL processes in our environment.</p><h3>Data Validation</h3><p>Always validate source and target record counts. Check for data transformations and business rules.</p>', 'Best Practices', 3, 'published', 'ETL,BestPractices,Testing');
  insertArticle.run('API Testing Standards', '<h2>API Testing Guidelines</h2><p>Standards for REST API testing across all projects.</p><h3>Tools</h3><p>Use Postman for manual testing and our custom API test collection for regression.</p>', 'Testing Standards', 3, 'published', 'API,Standards,Testing');
  insertArticle.run('RCA Template & Process', '<h2>Root Cause Analysis Process</h2><p>Standard process for conducting RCA on defects.</p><h3>5-Why Analysis</h3><p>Use the 5-Why method to trace defects to their root cause.</p>', 'RCA', 2, 'published', 'RCA,Template,Process');
  insertArticle.run('CF5 JSON Payload Guide', '<h2>CF5 JSON Payload Documentation</h2><p>Complete guide for CF5 JSON payload structure and validation rules.</p><pre><code>{\n  "claimId": "CF5-2025-001",\n  "memberNo": "123456789",\n  "amount": 50000.00\n}</code></pre>', 'Testing Standards', 3, 'published', 'CF5,JSON,Payload,Guide');
  insertArticle.run('Automation Framework Setup', '<h2>Test Automation Framework</h2><p>Setting up and running automated tests using Playwright.</p>', 'Best Practices', 3, 'draft', 'Automation,Playwright,Setup');

  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, type, title, message, read) VALUES (?, ?, ?, ?, ?)
  `);

  insertNotif.run(3, 'approval', 'File Approved', 'Your file "CF5 Test Plan v2" has been approved by QA Lead.', 0);
  insertNotif.run(3, 'review', 'Review Requested', '"CF5 XML Schema Validation" has been submitted for your review.', 0);
  insertNotif.run(2, 'upload', 'New File Uploaded', 'John Cruz uploaded "CF4 Performance Test Results" to CF4 repository.', 0);
  insertNotif.run(2, 'approval', 'Pending Approval', '3 files are waiting for your approval.', 0);
  insertNotif.run(4, 'version', 'New Version Available', '"Interim API Test Collection" has been updated to version 5.', 1);
  insertNotif.run(1, 'upload', 'Bulk Upload Complete', '12 files were successfully uploaded to ETL repository.', 1);
  insertNotif.run(3, 'review', 'Review Complete', 'Anna Reyes completed review on "CF4 Pemisc Test Cases v4".', 0);

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now', ? || ' minutes'))
  `);

  const auditData = [
    [1, 'LOGIN', 'user', 1, 'Successful login', '192.168.1.100', '-1'],
    [2, 'LOGIN', 'user', 2, 'Successful login', '192.168.1.101', '-5'],
    [3, 'UPLOAD', 'file', 1, 'Uploaded CF4 Pemisc Test Cases v4', '192.168.1.102', '-10'],
    [3, 'UPLOAD', 'file', 2, 'Uploaded CF4 RCA Report', '192.168.1.102', '-15'],
    [2, 'APPROVE', 'file', 2, 'Approved CF4 RCA Report', '192.168.1.101', '-20'],
    [4, 'UPLOAD', 'file', 5, 'Uploaded CF5 Sample JSON Payload', '192.168.1.103', '-25'],
    [3, 'DOWNLOAD', 'file', 1, 'Downloaded CF4 Pemisc Test Cases v4', '192.168.1.102', '-30'],
    [1, 'USER_CREATE', 'user', 5, 'Created viewer account for Stakeholder', '192.168.1.100', '-35'],
    [2, 'REPO_CREATE', 'repository', 3, 'Created CF4 repository folder', '192.168.1.101', '-40'],
    [3, 'FILE_UPDATE', 'file', 1, 'Updated metadata for CF4 test cases', '192.168.1.102', '-45'],
    [2, 'APPROVE', 'file', 4, 'Approved CF5 Test Plan v2', '192.168.1.101', '-50'],
    [5, 'DOWNLOAD', 'file', 3, 'Downloaded CF4 Evidence Screenshots', '192.168.1.104', '-55'],
    [1, 'PERMISSION_CHANGE', 'user', 3, 'Changed role from viewer to engineer', '192.168.1.100', '-60'],
    [3, 'UPLOAD', 'file', 7, 'Uploaded Interim API Test Collection', '192.168.1.102', '-65'],
    [4, 'UPLOAD', 'file', 8, 'Uploaded ETL Claims Template', '192.168.1.103', '-70'],
  ];

  for (const [uid, action, etype, eid, details, ip, offset] of auditData) {
    insertAudit.run(uid, action, etype, eid, details, ip, offset);
  }

  console.log('Database initialized and seeded successfully');
}

export default db;
