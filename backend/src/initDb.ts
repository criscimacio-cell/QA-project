import bcrypt from 'bcryptjs';
import sql from './db';

export async function initDb() {
  // ── Organizations (must exist before any org-scoped tables) ─────────────
  await sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      slug       TEXT UNIQUE NOT NULL,
      plan       TEXT NOT NULL DEFAULT 'free',
      active     BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Seed default org so existing rows can reference it
  await sql`
    INSERT INTO organizations (id, name, slug, plan)
    VALUES (1, 'Default Organization', 'default', 'free')
    ON CONFLICT (id) DO NOTHING
  `;

  // ── Platform Admins (separate from org users) ───────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS platform_admins (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      active        BOOLEAN DEFAULT TRUE,
      last_login    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Seed default platform admin
  const defaultPlatformAdminPw = bcrypt.hashSync('PlatformAdmin123!', 10);
  await sql`
    INSERT INTO platform_admins (name, email, password_hash)
    VALUES ('Platform Admin', 'platform@qlarity.com', ${defaultPlatformAdminPw})
    ON CONFLICT (email) DO NOTHING
  `;

  // ── Schema ──────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'viewer',
      department    TEXT DEFAULT '',
      avatar        TEXT DEFAULT '',
      active        BOOLEAN DEFAULT TRUE,
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      last_login    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS repositories (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      parent_id   INTEGER REFERENCES repositories(id),
      type        TEXT DEFAULT 'folder',
      project     TEXT DEFAULT '',
      owner_id    INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS files (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      original_name   TEXT NOT NULL,
      path            TEXT DEFAULT '',
      size            BIGINT DEFAULT 0,
      mime_type       TEXT DEFAULT '',
      repository_id   INTEGER REFERENCES repositories(id),
      owner_id        INTEGER REFERENCES users(id),
      version         INTEGER DEFAULT 1,
      status          TEXT DEFAULT 'draft',
      project         TEXT DEFAULT '',
      module          TEXT DEFAULT '',
      category        TEXT DEFAULT '',
      jira_ticket     TEXT DEFAULT '',
      tags            TEXT DEFAULT '',
      description     TEXT DEFAULT '',
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_files_fts ON files USING GIN (
      to_tsvector('english',
        coalesce(name,'') || ' ' ||
        coalesce(description,'') || ' ' ||
        coalesce(tags,'') || ' ' ||
        coalesce(project,'') || ' ' ||
        coalesce(jira_ticket,'')
      )
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS file_versions (
      id          SERIAL PRIMARY KEY,
      file_id     INTEGER REFERENCES files(id),
      version     INTEGER NOT NULL,
      path        TEXT DEFAULT '',
      size        BIGINT DEFAULT 0,
      change_log  TEXT DEFAULT '',
      created_by  INTEGER REFERENCES users(id),
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id          SERIAL PRIMARY KEY,
      title       TEXT NOT NULL,
      content     TEXT DEFAULT '',
      category    TEXT DEFAULT '',
      author_id   INTEGER REFERENCES users(id),
      status      TEXT DEFAULT 'draft',
      tags        TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS idx_kb_fts ON knowledge_articles USING GIN (
      to_tsvector('english', coalesce(title,'') || ' ' || coalesce(tags,'') || ' ' || coalesce(category,''))
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id),
      type        TEXT DEFAULT 'info',
      title       TEXT NOT NULL,
      message     TEXT DEFAULT '',
      read        BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id),
      action      TEXT NOT NULL,
      entity_type TEXT DEFAULT '',
      entity_id   INTEGER DEFAULT 0,
      details     TEXT DEFAULT '',
      ip_address  TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS approvals (
      id          SERIAL PRIMARY KEY,
      file_id     INTEGER REFERENCES files(id),
      reviewer_id INTEGER REFERENCES users(id),
      status      TEXT DEFAULT 'pending',
      comments    TEXT DEFAULT '',
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id),
      token       TEXT UNIQUE NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      used        BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token       TEXT UNIQUE NOT NULL,
      expires_at  TIMESTAMPTZ NOT NULL,
      revoked     BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS categories (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      type       TEXT NOT NULL DEFAULT 'file',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(name, type)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS file_comments (
      id         SERIAL PRIMARY KEY,
      file_id    INTEGER REFERENCES files(id) ON DELETE CASCADE,
      user_id    INTEGER REFERENCES users(id),
      comment    TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences TEXT DEFAULT '{}'`;

  // ── Multi-tenancy migration: add organization_id to all tables ──────────
  // Add to users
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE users SET organization_id = 1 WHERE organization_id IS NULL`;

  // Replace single-email unique constraint with email+org unique constraint
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_org_unique') THEN
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
        ALTER TABLE users ADD CONSTRAINT users_email_org_unique UNIQUE (email, organization_id);
      END IF;
    END $$
  `;

  // Add to core tables
  await sql`ALTER TABLE repositories ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE repositories SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE files ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE files SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE file_versions ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE file_versions SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE file_comments ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE file_comments SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE approvals ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE approvals SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE knowledge_articles SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE notifications SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE audit_logs SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE categories ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE categories SET organization_id = 1 WHERE organization_id IS NULL`;

  // Replace categories unique constraint to include org
  await sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_type_org_unique') THEN
        ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_name_type_key;
        ALTER TABLE categories ADD CONSTRAINT categories_name_type_org_unique UNIQUE (name, type, organization_id);
      END IF;
    END $$
  `;

  await sql`ALTER TABLE password_reset_tokens ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE password_reset_tokens SET organization_id = 1 WHERE organization_id IS NULL`;

  await sql`ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) DEFAULT 1`;
  await sql`UPDATE refresh_tokens SET organization_id = 1 WHERE organization_id IS NULL`;

  // ── Seed categories ──────────────────────────────────────────────────────
  const [{ c: catCount }] = await sql`SELECT COUNT(*)::int as c FROM categories WHERE organization_id = 1`;
  if (catCount === 0) {
    for (const name of ['Test Cases','RCA','Evidence','Test Plan','Test Data','Bug Report','Template','Test Scripts','Performance']) {
      await sql`INSERT INTO categories (name, type, organization_id) VALUES (${name}, 'file', 1) ON CONFLICT DO NOTHING`;
    }
    for (const name of ['Troubleshooting','RCA','Testing Standards','Best Practices','Onboarding','Process Documentation']) {
      await sql`INSERT INTO categories (name, type, organization_id) VALUES (${name}, 'knowledge', 1) ON CONFLICT DO NOTHING`;
    }
  }

  // ── Seed demo users ──────────────────────────────────────────────────────
  const [existingAdmin] = await sql`SELECT id FROM users WHERE email = 'admin@qa.com' AND organization_id = 1`;
  if (!existingAdmin) {
    const hash = (pw: string) => bcrypt.hashSync(pw, 10);
    for (const u of [
      { name: 'QA Administrator', email: 'admin@qa.com',     pw: 'password123', role: 'admin',    dept: 'QA Department', seed: 'admin' },
      { name: 'QA Lead',          email: 'lead@qa.com',      pw: 'password123', role: 'lead',     dept: 'QA Department', seed: 'lead'  },
      { name: 'QA Engineer 1',    email: 'engineer1@qa.com', pw: 'password123', role: 'engineer', dept: 'QA Department', seed: 'eng1'  },
      { name: 'QA Engineer 2',    email: 'engineer2@qa.com', pw: 'password123', role: 'engineer', dept: 'QA Department', seed: 'eng2'  },
      { name: 'Stakeholder',      email: 'viewer@qa.com',    pw: 'password123', role: 'viewer',   dept: 'Business',      seed: 'viewer'},
    ]) {
      await sql`
        INSERT INTO users (name, email, password_hash, role, department, avatar, organization_id)
        VALUES (${u.name}, ${u.email}, ${hash(u.pw)}, ${u.role}, ${u.dept},
                ${'https://api.dicebear.com/7.x/avataaars/svg?seed=' + u.seed}, 1)
        ON CONFLICT DO NOTHING
      `;
    }
    console.log('Default accounts created.');
  }

  // ── Seed KB articles ─────────────────────────────────────────────────────
  const [{ c: kbCount }] = await sql`SELECT COUNT(*)::int as c FROM knowledge_articles WHERE category != 'General' AND organization_id = 1`;
  if (kbCount === 0) {
    const [admin] = await sql`SELECT id FROM users WHERE email = 'admin@qa.com' AND organization_id = 1`;
    const [lead]  = await sql`SELECT id FROM users WHERE email = 'lead@qa.com' AND organization_id = 1`;
    const [eng3]  = await sql`SELECT id FROM users WHERE email = 'engineer1@qa.com' AND organization_id = 1`;
    const adminId = admin?.id ?? 1;
    const leadId  = lead?.id ?? 2;
    const eng3Id  = eng3?.id ?? 3;

    const articles = [
      { title: 'QA Testing Standards & Guidelines', category: 'Testing Standards', authorId: adminId, tags: 'standards,coverage,naming,DoD', created: '2026-05-01 09:00:00', updated: '2026-06-01 10:30:00',
        content: '<h2>Overview</h2><p>This document outlines the core testing standards followed by the QA team to ensure consistent, high-quality software delivery.</p><h2>Test Coverage Requirements</h2><ul><li><strong>Unit Tests:</strong> Minimum 80% code coverage on all new modules</li><li><strong>Integration Tests:</strong> All API endpoints must have at least one happy-path and one error-path test</li><li><strong>E2E Tests:</strong> Critical user flows (login, checkout, dashboard) must be covered</li><li><strong>Regression Tests:</strong> Run on every pull request before merge</li></ul><h2>Test Naming Convention</h2><p>Tests must follow the pattern: <code>[Unit/Feature]_[ComponentName]_[Action]_[ExpectedOutcome]</code></p><h2>Definition of Done (DoD)</h2><p>A feature is considered done when: all tests pass, coverage thresholds are met, no critical or high bugs remain open, and a QA sign-off has been recorded in this system.</p>' },
      { title: 'Bug Severity & Priority Classification Guide', category: 'Testing Standards', authorId: leadId, tags: 'bugs,severity,priority,triage', created: '2026-05-05 10:00:00', updated: '2026-06-02 11:30:00',
        content: '<h2>Severity Levels</h2><p>Severity describes the <strong>technical impact</strong> of a bug on the system.</p><ul><li><strong>S1 - Critical:</strong> System crash, data loss, security breach</li><li><strong>S2 - Major:</strong> Key feature not working, no workaround</li><li><strong>S3 - Moderate:</strong> Feature works but degraded, workaround exists</li><li><strong>S4 - Minor:</strong> Cosmetic or low-impact issue</li></ul><h2>Priority Levels</h2><ul><li><strong>P1 - Immediate:</strong> Fix within 24 hours</li><li><strong>P2 - High:</strong> Fix within current sprint</li><li><strong>P3 - Medium:</strong> Fix in next sprint</li><li><strong>P4 - Low:</strong> Backlog</li></ul>' },
      { title: 'Writing Effective Test Cases', category: 'Testing Standards', authorId: leadId, tags: 'test cases,writing,templates,gherkin', created: '2026-05-09 11:00:00', updated: '2026-06-03 12:30:00',
        content: '<h2>Anatomy of a Good Test Case</h2><ol><li><strong>Test Case ID</strong> — Unique identifier (e.g., TC-AUTH-001)</li><li><strong>Title</strong> — Short, action-oriented description</li><li><strong>Preconditions</strong> — System state before the test begins</li><li><strong>Test Steps</strong> — Numbered, atomic actions</li><li><strong>Expected Result</strong> — Precise, measurable outcome</li></ol><h2>Gherkin / BDD Style</h2><pre>Given I am on the login page\nWhen I enter valid credentials\nThen I should be redirected to the dashboard</pre>' },
      { title: 'Root Cause Analysis (RCA) Process', category: 'RCA', authorId: adminId, tags: 'RCA,root cause,5-whys,post-mortem', created: '2026-05-13 09:00:00', updated: '2026-06-04 10:30:00',
        content: '<h2>What is RCA?</h2><p>Root Cause Analysis is a structured method to identify <em>why</em> a defect or incident occurred so we can prevent recurrence.</p><h2>When to Conduct an RCA</h2><ul><li>Any S1/P1 production incident</li><li>Escaped defects (bugs found by customers)</li><li>Repeated bugs in the same component (3+ times in a quarter)</li></ul><h2>The 5-Whys Technique</h2><pre>Problem: Login page returned 500 for all users\nWhy 1: The auth service crashed\nWhy 2: It ran out of database connections\nWhy 3: Connections were never released after timeout\nRoot Cause: Missing finally block for connection cleanup</pre><h2>RCA SLA</h2><p>RCA documents must be completed within <strong>5 business days</strong> of incident resolution.</p>' },
      { title: 'Regression Testing Strategy', category: 'Best Practices', authorId: leadId, tags: 'regression,automation,smoke,sanity,CI', created: '2026-05-17 10:00:00', updated: '2026-06-05 11:30:00',
        content: '<h2>Test Suite Layers</h2><h3>1. Smoke Suite (5-10 minutes)</h3><p>Runs on every commit. Covers critical paths: authentication, homepage, API health.</p><h3>2. Sanity Suite (20-30 minutes)</h3><p>Runs on every PR merge. Covers all major features at a high level.</p><h3>3. Full Regression (2-4 hours)</h3><p>Runs nightly and before every production release.</p><h2>Flaky Test Policy</h2><p>Flaky tests must be tagged <code>@flaky</code> immediately, investigated within 3 business days, and fixed or deleted within 10 business days.</p>' },
      { title: 'Performance Testing Guidelines', category: 'Testing Standards', authorId: adminId, tags: 'performance,load testing,k6,benchmarks', created: '2026-05-21 09:00:00', updated: '2026-06-06 10:30:00',
        content: '<h2>Types of Performance Tests</h2><ul><li><strong>Load Test:</strong> Normal expected load</li><li><strong>Stress Test:</strong> Beyond normal load — finds the breaking point</li><li><strong>Soak Test:</strong> Sustained load over hours — detects memory leaks</li><li><strong>Spike Test:</strong> Sudden traffic surge</li></ul><h2>Acceptance Criteria</h2><ul><li>API p95 response time: &lt; 300ms (max 1000ms)</li><li>Page load: &lt; 2s (max 4s)</li><li>Error rate under load: &lt; 0.1%</li></ul><h2>Tooling</h2><ul><li><strong>k6</strong> — API and load testing</li><li><strong>Lighthouse</strong> — Frontend performance</li><li><strong>Grafana + Prometheus</strong> — Real-time metrics</li></ul>' },
      { title: 'New QA Engineer Onboarding Guide', category: 'Onboarding', authorId: adminId, tags: 'onboarding,new hire,setup,tools,access', created: '2026-05-25 10:00:00', updated: '2026-06-07 11:30:00',
        content: '<h2>Day 1 - Access and Setup</h2><ul><li>Request Jira access from your team lead</li><li>Clone the test automation repository</li><li>Install Node.js 18+, Python 3.10+, and Docker</li><li>Run <code>npm install</code> and <code>npx playwright install</code></li><li>Run the smoke suite locally: <code>npm run test:smoke</code></li></ul><h2>Day 2-3 - Learn the Codebase</h2><ul><li>Read the Test Architecture document</li><li>Shadow a senior QA engineer during exploratory testing</li><li>Review the last 5 RCA reports</li></ul><h2>Day 4-5 - First Contribution</h2><ul><li>Pick a good first test ticket from the backlog</li><li>Write and submit your first test case for review</li></ul>' },
      { title: 'API Testing Best Practices', category: 'Best Practices', authorId: leadId, tags: 'API,REST,contract testing,schema validation', created: '2026-05-29 11:00:00', updated: '2026-06-08 12:30:00',
        content: '<h2>What to Test at the API Layer</h2><ol><li><strong>Happy Path:</strong> Valid inputs produce correct outputs</li><li><strong>Authentication:</strong> Unauthenticated requests return 401; wrong role returns 403</li><li><strong>Validation:</strong> Missing required fields return 400</li><li><strong>Edge Cases:</strong> Empty arrays, null values, very long strings</li><li><strong>Rate Limiting:</strong> Repeated requests eventually return 429</li></ol><h2>Schema Validation</h2><p>Every API response must be validated against a JSON Schema. Use Zod in test code.</p><h2>Test Data Strategy</h2><ul><li>Create test data via API calls (not DB inserts)</li><li>Clean up created resources in afterEach or afterAll</li></ul>' },
      { title: 'Exploratory Testing Techniques', category: 'Best Practices', authorId: eng3Id, tags: 'exploratory,manual testing,heuristics,session-based', created: '2026-06-02 09:00:00', updated: '2026-06-09 10:30:00',
        content: '<h2>What is Exploratory Testing?</h2><p>Exploratory testing is simultaneous learning, test design, and test execution — guided by heuristics and charters, not ad-hoc.</p><h2>Session-Based Test Management (SBTM)</h2><p>Time-boxed sessions (45-90 min) with a clear charter. Document findings, bugs, and questions.</p><h2>SFDIPOT Heuristic</h2><ul><li><strong>S - Structure:</strong> What is the product made of?</li><li><strong>F - Function:</strong> What does it do?</li><li><strong>D - Data:</strong> What data does it process?</li><li><strong>I - Interfaces:</strong> How does it connect to other things?</li><li><strong>P - Platform:</strong> What environment does it rely on?</li><li><strong>O - Operations:</strong> How will it be used?</li><li><strong>T - Time:</strong> How does it behave over time?</li></ul>' },
      { title: 'Test Automation Framework Architecture', category: 'Process Documentation', authorId: adminId, tags: 'automation,framework,Playwright,CI/CD,page-objects', created: '2026-06-06 10:00:00', updated: '2026-06-10 11:30:00',
        content: '<h2>Framework Overview</h2><p>Built on <strong>Playwright</strong> (E2E) and <strong>Vitest</strong> (unit/integration), following the Page Object Model pattern.</p><h2>CI/CD Integration</h2><ul><li><strong>On PR:</strong> Smoke and Sanity suites via GitHub Actions</li><li><strong>On merge to main:</strong> Full regression suite</li><li><strong>Nightly:</strong> Full regression and performance suite</li></ul><h2>data-testid Convention</h2><p>All interactive elements must have a <code>data-testid</code> attribute in format <code>[component]-[action]</code>. Examples: <code>login-submit-button</code>, <code>file-upload-dropzone</code></p>' },
      { title: 'Incident Response & Escalation Procedure', category: 'Process Documentation', authorId: adminId, tags: 'incident,escalation,on-call,P1,production', created: '2026-06-10 09:00:00', updated: '2026-06-11 10:30:00',
        content: '<h2>Escalation Matrix</h2><ul><li><strong>P1 - Critical:</strong> 15 min — On-call engineer + QA Lead + Manager</li><li><strong>P2 - High:</strong> 2 hours — On-call engineer + QA Lead</li><li><strong>P3 - Medium:</strong> Next business day</li><li><strong>P4 - Low:</strong> Within 5 days</li></ul><h2>Incident Response Steps</h2><ol><li>Detect and assess severity</li><li>Declare incident; open war-room channel</li><li>Communicate status every 30 minutes</li><li>Mitigate or rollback</li><li>Resolve and confirm in production</li><li>Conduct RCA within 5 business days</li></ol>' },
      { title: 'Accessibility (a11y) Testing Checklist', category: 'Best Practices', authorId: eng3Id, tags: 'accessibility,a11y,WCAG,screen reader,axe', created: '2026-06-12 10:00:00', updated: '2026-06-12 10:00:00',
        content: '<h2>Why Accessibility Testing?</h2><p>Ensures our product is usable by people with disabilities. We target WCAG 2.1 AA.</p><h2>Automated Checks</h2><p>Use <strong>axe-core</strong> with Playwright. Note: automated tools catch only 30-40% of issues.</p><h2>Manual Checklist</h2><h3>Keyboard Navigation</h3><ul><li>All interactive elements reachable by Tab</li><li>Focus order is logical</li><li>Focus indicator is clearly visible</li></ul><h3>Screen Reader</h3><ul><li>All images have descriptive alt text</li><li>Form labels are programmatically associated with inputs</li><li>Error messages announced on validation failure</li></ul><h3>Visual</h3><ul><li>Colour contrast ratio 4.5:1 for normal text</li><li>No information conveyed by colour alone</li></ul>' },
    ];

    for (const a of articles) {
      await sql`
        INSERT INTO knowledge_articles (title, content, category, author_id, status, tags, created_at, updated_at, organization_id)
        VALUES (${a.title}, ${a.content}, ${a.category}, ${a.authorId}, 'published', ${a.tags}, ${a.created}, ${a.updated}, 1)
      `;
    }
    console.log('Knowledge base articles seeded.');
  }

  console.log('Database initialization complete.');
}
