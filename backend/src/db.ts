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
  if (!existingUser) {
    const hash = (pw: string) => bcrypt.hashSync(pw, 10);
    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, department, avatar) VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertUser.run('QA Administrator', 'admin@qa.com',    hash('password123'), 'admin',    'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin');
    insertUser.run('QA Lead',          'lead@qa.com',     hash('password123'), 'lead',     'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=lead');
    insertUser.run('QA Engineer 1',    'engineer1@qa.com',hash('password123'), 'engineer', 'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=eng1');
    insertUser.run('QA Engineer 2',    'engineer2@qa.com',hash('password123'), 'engineer', 'QA Department', 'https://api.dicebear.com/7.x/avataaars/svg?seed=eng2');
    insertUser.run('Stakeholder',      'viewer@qa.com',   hash('password123'), 'viewer',   'Business',      'https://api.dicebear.com/7.x/avataaars/svg?seed=viewer');
    console.log('Default accounts created.');
  }

  // Seed KB articles — runs independently so existing databases get articles too
  const existingKb = db.prepare('SELECT COUNT(*) as c FROM knowledge_articles WHERE category != "General"').get() as any;
  if (existingKb.c === 0) {
    const insertKb = db.prepare(`
      INSERT INTO knowledge_articles (title, content, category, author_id, status, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const kbArticles: [string, string, string, number, string, string, string, string][] = [
      [
        'QA Testing Standards & Guidelines',
        '<h2>Overview</h2><p>This document outlines the core testing standards followed by the QA team to ensure consistent, high-quality software delivery.</p><h2>Test Coverage Requirements</h2><ul><li><strong>Unit Tests:</strong> Minimum 80% code coverage on all new modules</li><li><strong>Integration Tests:</strong> All API endpoints must have at least one happy-path and one error-path test</li><li><strong>E2E Tests:</strong> Critical user flows (login, checkout, dashboard) must be covered</li><li><strong>Regression Tests:</strong> Run on every pull request before merge</li></ul><h2>Test Naming Convention</h2><p>Tests must follow the pattern: <code>[Unit/Feature]_[ComponentName]_[Action]_[ExpectedOutcome]</code></p><p>Example: <code>Unit_LoginForm_InvalidEmail_ShowsValidationError</code></p><h2>Test Environment Rules</h2><ul><li>Never run tests against production data</li><li>Use seeded test databases only</li><li>Clear test state between each test run</li><li>Mock external APIs and third-party services</li></ul><h2>Definition of Done (DoD)</h2><p>A feature is considered done when: all tests pass, coverage thresholds are met, no critical or high bugs remain open, and a QA sign-off has been recorded in this system.</p>',
        'Testing Standards', 1, 'published', 'standards,coverage,naming,DoD',
        '2026-05-01 09:00:00', '2026-06-01 10:30:00'
      ],
      [
        'Bug Severity & Priority Classification Guide',
        '<h2>Severity Levels</h2><p>Severity describes the <strong>technical impact</strong> of a bug on the system.</p><table><thead><tr><th>Severity</th><th>Description</th><th>Examples</th></tr></thead><tbody><tr><td><strong>S1 - Critical</strong></td><td>System crash, data loss, security breach</td><td>Login broken for all users, DB corruption</td></tr><tr><td><strong>S2 - Major</strong></td><td>Key feature not working, no workaround</td><td>Export fails, payment rejected</td></tr><tr><td><strong>S3 - Moderate</strong></td><td>Feature works but degraded, workaround exists</td><td>Slow report load, wrong count displayed</td></tr><tr><td><strong>S4 - Minor</strong></td><td>Cosmetic or low-impact issue</td><td>Typo, misaligned button, wrong color</td></tr></tbody></table><h2>Priority Levels</h2><ul><li><strong>P1 - Immediate:</strong> Fix within 24 hours, escalate to on-call</li><li><strong>P2 - High:</strong> Fix within current sprint</li><li><strong>P3 - Medium:</strong> Fix in next sprint</li><li><strong>P4 - Low:</strong> Backlog, fix when bandwidth allows</li></ul><h2>Severity vs. Priority Matrix</h2><p>A bug can be S1 but P3 (e.g., crash only on unsupported browser) or S4 but P1 (e.g., CEO name misspelled on homepage before a launch). Always document the reasoning when severity and priority differ.</p>',
        'Testing Standards', 2, 'published', 'bugs,severity,priority,triage',
        '2026-05-05 10:00:00', '2026-06-02 11:30:00'
      ],
      [
        'Writing Effective Test Cases',
        '<h2>Anatomy of a Good Test Case</h2><p>Every test case must include the following fields:</p><ol><li><strong>Test Case ID</strong> - Unique identifier (e.g., TC-AUTH-001)</li><li><strong>Title</strong> - Short, action-oriented description</li><li><strong>Preconditions</strong> - System state before the test begins</li><li><strong>Test Steps</strong> - Numbered, atomic actions</li><li><strong>Test Data</strong> - Exact values to use</li><li><strong>Expected Result</strong> - Precise, measurable outcome</li><li><strong>Actual Result</strong> - Filled during execution</li><li><strong>Pass/Fail</strong></li></ol><h2>Example: Login Test Case</h2><pre>TC-AUTH-001: Valid user can log in with correct credentials\n\nPreconditions:\n  - User account exists: user@qa.com / Password123\n  - Browser: Chrome latest\n\nSteps:\n  1. Navigate to /login\n  2. Enter email: user@qa.com\n  3. Enter password: Password123\n  4. Click Sign In\n\nExpected Result:\n  - Redirected to /dashboard\n  - Header shows user display name\n  - Session token stored in localStorage</pre><h2>Gherkin / BDD Style</h2><pre>Given I am on the login page\nWhen I enter valid credentials\nAnd I click Sign In\nThen I should be redirected to the dashboard\nAnd I should see my name in the top bar</pre><h2>Common Mistakes to Avoid</h2><ul><li>Vague expected results ("page should load" vs "dashboard loads within 3s")</li><li>Multiple actions in one step</li><li>Missing preconditions</li><li>No test data specified</li></ul>',
        'Testing Standards', 2, 'published', 'test cases,writing,templates,gherkin',
        '2026-05-09 11:00:00', '2026-06-03 12:30:00'
      ],
      [
        'Root Cause Analysis (RCA) Process',
        '<h2>What is RCA?</h2><p>Root Cause Analysis is a structured method to identify <em>why</em> a defect or incident occurred so we can prevent recurrence.</p><h2>When to Conduct an RCA</h2><ul><li>Any S1/P1 production incident</li><li>Escaped defects (bugs found by customers, not QA)</li><li>Repeated bugs in the same component (3+ times in a quarter)</li><li>Test automation failures that block CI for more than 2 hours</li></ul><h2>The 5-Whys Technique</h2><pre>Problem: Login page returned HTTP 500 for all users\n\nWhy 1: The auth service crashed\nWhy 2: It ran out of database connections\nWhy 3: A connection pool was never released after a timeout\nWhy 4: Error handling code did not include a finally block to close connections\nWhy 5: Code review checklist did not include connection lifecycle checks\n\nRoot Cause: Missing code review item for resource cleanup in async flows\nFix: Add resource-lifecycle checklist item; add integration test for timeout scenarios</pre><h2>RCA Report Template</h2><ol><li><strong>Incident Summary</strong> - What happened, when, impact</li><li><strong>Timeline</strong> - Detection to response to resolution</li><li><strong>Root Cause</strong> - The fundamental reason</li><li><strong>Contributing Factors</strong> - Other weaknesses that allowed it</li><li><strong>Corrective Actions</strong> - What will prevent recurrence (with owner and due date)</li><li><strong>Lessons Learned</strong> - Process improvements</li></ol><h2>RCA SLA</h2><p>RCA documents must be completed within <strong>5 business days</strong> of incident resolution and uploaded to this system under the RCA category.</p>',
        'RCA', 1, 'published', 'RCA,root cause,5-whys,post-mortem',
        '2026-05-13 09:00:00', '2026-06-04 10:30:00'
      ],
      [
        'Regression Testing Strategy',
        '<h2>What is Regression Testing?</h2><p>Regression testing verifies that new changes have not broken existing functionality. It is our last line of defence before every release.</p><h2>Test Suite Layers</h2><h3>1. Smoke Suite (5-10 minutes)</h3><p>Runs on every commit. Covers absolute critical paths: authentication, homepage load, core API health check, database connectivity.</p><h3>2. Sanity Suite (20-30 minutes)</h3><p>Runs on every pull request merge to main. Covers all major features at a high level.</p><h3>3. Full Regression Suite (2-4 hours)</h3><p>Runs nightly and before every production release. Covers edge cases, negative paths, and cross-browser scenarios.</p><h2>Automation First Policy</h2><p>Any test run manually more than twice must be automated. Priority order:</p><ol><li>P1/P2 bug scenario found in production</li><li>Happy paths for all features</li><li>Error paths for API boundaries</li><li>Performance benchmarks</li></ol><h2>Flaky Test Policy</h2><p>A test that fails intermittently without code changes is a flaky test. Flaky tests must be tagged <code>@flaky</code> immediately, investigated within 3 business days, and fixed or deleted within 10 business days. Treat flaky tests as bugs.</p>',
        'Best Practices', 2, 'published', 'regression,automation,smoke,sanity,CI',
        '2026-05-17 10:00:00', '2026-06-05 11:30:00'
      ],
      [
        'Performance Testing Guidelines',
        '<h2>Overview</h2><p>Performance testing ensures our system meets response time, throughput, and stability requirements under expected and peak load conditions.</p><h2>Types of Performance Tests</h2><ul><li><strong>Load Test:</strong> Normal expected load - validates baseline performance</li><li><strong>Stress Test:</strong> Beyond normal load - finds the breaking point</li><li><strong>Soak/Endurance Test:</strong> Sustained load over hours - detects memory leaks</li><li><strong>Spike Test:</strong> Sudden traffic surge - validates auto-scaling and recovery</li></ul><h2>Performance Acceptance Criteria</h2><table><thead><tr><th>Metric</th><th>Target</th><th>Max Allowed</th></tr></thead><tbody><tr><td>API response time (p95)</td><td>300ms</td><td>1000ms</td></tr><tr><td>Page load time</td><td>2s</td><td>4s</td></tr><tr><td>Error rate under load</td><td>0.1%</td><td>1%</td></tr><tr><td>CPU usage at peak</td><td>70%</td><td>90%</td></tr></tbody></table><h2>Tooling</h2><ul><li><strong>k6</strong> - Preferred for API and load testing</li><li><strong>Lighthouse</strong> - Frontend performance audits</li><li><strong>Grafana + Prometheus</strong> - Real-time metrics during test runs</li></ul><h2>When to Run</h2><ul><li>Before every major release</li><li>After any database schema change</li><li>After infrastructure changes</li><li>When a P2+ performance bug is fixed</li></ul>',
        'Testing Standards', 1, 'published', 'performance,load testing,k6,benchmarks',
        '2026-05-21 09:00:00', '2026-06-06 10:30:00'
      ],
      [
        'New QA Engineer Onboarding Guide',
        '<h2>Welcome to the QA Team!</h2><p>This guide will get you set up and productive in your first week. Complete each section in order.</p><h2>Day 1 - Access and Setup</h2><ul><li>Request Jira access from your team lead</li><li>Clone the test automation repository</li><li>Install Node.js 18+, Python 3.10+, and Docker</li><li>Run <code>npm install</code> and <code>npx playwright install</code></li><li>Set up your <code>.env.test</code> file (template in /docs/env-template)</li><li>Run the smoke suite locally: <code>npm run test:smoke</code></li></ul><h2>Day 2-3 - Learn the Codebase</h2><ul><li>Read the Test Architecture document</li><li>Shadow a senior QA engineer during exploratory testing</li><li>Review the last 5 RCA reports to understand common failure patterns</li><li>Run the full regression suite once to see coverage</li></ul><h2>Day 4-5 - First Contribution</h2><ul><li>Pick a good first test ticket from the backlog</li><li>Write and submit your first test case for review</li><li>Pair with your buddy for a code review session</li></ul><h2>Useful Links</h2><ul><li>Test case naming conventions - see Testing Standards article</li><li>Bug severity guide - see Severity and Priority Classification article</li><li>Slack channels: #qa-team, #incidents, #test-results</li></ul>',
        'Onboarding', 1, 'published', 'onboarding,new hire,setup,tools,access',
        '2026-05-25 10:00:00', '2026-06-07 11:30:00'
      ],
      [
        'API Testing Best Practices',
        '<h2>Why API Testing Matters</h2><p>API tests sit between unit tests and E2E tests in the testing pyramid. They are faster than E2E tests, more reliable, and catch integration failures that unit tests miss.</p><h2>What to Test at the API Layer</h2><ol><li><strong>Happy Path:</strong> Valid inputs produce correct outputs and HTTP status codes</li><li><strong>Authentication:</strong> Unauthenticated requests return 401; wrong role returns 403</li><li><strong>Validation:</strong> Missing required fields return 400 with meaningful error messages</li><li><strong>Edge Cases:</strong> Empty arrays, null values, very long strings, special characters</li><li><strong>Error Handling:</strong> Server errors return 500 (not 200 with error in body)</li><li><strong>Rate Limiting:</strong> Repeated requests eventually return 429</li></ol><h2>Schema Validation</h2><p>Every API response must be validated against a JSON Schema. Use Ajv or Zod in test code:</p><pre>const responseSchema = z.object({\n  id: z.number(),\n  title: z.string(),\n  status: z.enum(["draft", "published"]),\n  created_at: z.string().datetime()\n});\n\nconst res = await api.get("/knowledge/1");\nexpect(() => responseSchema.parse(res.data)).not.toThrow();</pre><h2>Test Data Strategy</h2><ul><li>Create test data via API calls (not DB inserts)</li><li>Clean up created resources in afterEach or afterAll</li><li>Never depend on data created by a previous test - tests must be independent</li></ul>',
        'Best Practices', 2, 'published', 'API,REST,Postman,contract testing,schema validation',
        '2026-05-29 11:00:00', '2026-06-08 12:30:00'
      ],
      [
        'Exploratory Testing Techniques',
        '<h2>What is Exploratory Testing?</h2><p>Exploratory testing is simultaneous learning, test design, and test execution. It is structured creative testing guided by heuristics and charters - not ad-hoc.</p><h2>Session-Based Test Management (SBTM)</h2><p>Exploratory sessions are time-boxed (45-90 min) with a clear charter:</p><pre>Charter: Explore the file upload feature focusing on file size and format edge cases\nSession: 60 minutes | Tester: Engineer 1 | Environment: Staging v2.3.1\n\nNotes:\n- JPEG, PNG, PDF upload correctly           PASS\n- Files over 50MB correctly rejected        PASS\n- Zero-byte files accepted but show 0KB     QUESTION (intended?)\n- Filename with emoji displayed as ???      BUG\n- Duplicate filename silently overwrites    BUG</pre><h2>Useful Heuristics (SFDIPOT)</h2><ul><li><strong>S - Structure:</strong> What is the product made of?</li><li><strong>F - Function:</strong> What does it do?</li><li><strong>D - Data:</strong> What data does it process?</li><li><strong>I - Interfaces:</strong> How does it connect to other things?</li><li><strong>P - Platform:</strong> What environment does it rely on?</li><li><strong>O - Operations:</strong> How will it be used and by whom?</li><li><strong>T - Time:</strong> How does it behave over time?</li></ul><h2>Bug Magnet Areas</h2><ul><li>Empty states (no data, no results)</li><li>Long strings and special characters (unicode, SQL fragments, HTML tags)</li><li>Concurrent operations (double-click, rapid navigation)</li><li>Session expiry during a multi-step form</li><li>Browser back button after a state change</li></ul>',
        'Best Practices', 3, 'published', 'exploratory,manual testing,heuristics,charters,session-based',
        '2026-06-02 09:00:00', '2026-06-09 10:30:00'
      ],
      [
        'Test Automation Framework Architecture',
        '<h2>Framework Overview</h2><p>Our test automation framework is built on <strong>Playwright</strong> (E2E) and <strong>Vitest</strong> (unit/integration), following the Page Object Model pattern with a layered architecture.</p><h2>Directory Structure</h2><pre>qa-automation/\n+-- e2e/\n|   +-- pages/       # Page Object classes\n|   +-- fixtures/    # Playwright fixtures and test data\n|   +-- tests/       # Test specs organised by feature\n|   +-- utils/       # Helper functions\n+-- api-tests/\n|   +-- specs/       # API test specs\n|   +-- schemas/     # JSON schema files\n+-- unit/\n|   +-- components/  # Component-level tests\n+-- playwright.config.ts</pre><h2>Page Object Model</h2><pre>export class LoginPage {\n  constructor(private page: Page) {}\n\n  async login(email: string, password: string) {\n    await this.page.fill(\'[data-testid="email"]\', email);\n    await this.page.fill(\'[data-testid="password"]\', password);\n    await this.page.click(\'[data-testid="submit"]\');\n  }\n}</pre><h2>CI/CD Integration</h2><ul><li><strong>On PR:</strong> Smoke and Sanity suites via GitHub Actions</li><li><strong>On merge to main:</strong> Full regression suite</li><li><strong>Nightly:</strong> Full regression and performance suite</li><li>Test results published to Allure Report dashboard</li><li>Slack notification to #test-results on failure</li></ul><h2>data-testid Convention</h2><p>All interactive elements must have a <code>data-testid</code> attribute in format <code>[component]-[action]</code>. Examples: <code>login-submit-button</code>, <code>file-upload-dropzone</code></p>',
        'Process Documentation', 1, 'published', 'automation,framework,Playwright,CI/CD,page-objects',
        '2026-06-06 10:00:00', '2026-06-10 11:30:00'
      ],
      [
        'Incident Response & Escalation Procedure',
        '<h2>Severity Threshold for Incidents</h2><p>An incident is declared when a production system is degraded or unavailable, impacting real users.</p><h2>Escalation Matrix</h2><table><thead><tr><th>Priority</th><th>Response Time</th><th>Who to Notify</th></tr></thead><tbody><tr><td>P1 - Critical</td><td>15 minutes</td><td>On-call engineer + QA Lead + Engineering Manager</td></tr><tr><td>P2 - High</td><td>2 hours</td><td>On-call engineer + QA Lead</td></tr><tr><td>P3 - Medium</td><td>Next business day</td><td>Assigned QA engineer</td></tr><tr><td>P4 - Low</td><td>Within 5 days</td><td>Backlog ticket</td></tr></tbody></table><h2>Incident Response Steps</h2><ol><li><strong>Detect:</strong> Alert triggered or user report received</li><li><strong>Assess:</strong> Determine severity and affected users within 5 minutes</li><li><strong>Declare:</strong> Create incident ticket; open war room Slack channel (#incident-YYYY-MM-DD)</li><li><strong>Communicate:</strong> Post status update to stakeholders every 30 minutes</li><li><strong>Mitigate:</strong> Apply temporary fix or rollback if available</li><li><strong>Resolve:</strong> Confirm fix is working in production; close incident</li><li><strong>Review:</strong> Conduct RCA within 5 business days</li></ol><h2>QA Role During Incidents</h2><ul><li>Reproduce the issue in staging to confirm the bug and its scope</li><li>Run targeted regression after each fix attempt</li><li>Verify the fix in production before incident closure</li><li>Document test scenarios added to prevent recurrence</li></ul>',
        'Process Documentation', 1, 'published', 'incident,escalation,on-call,P1,production',
        '2026-06-10 09:00:00', '2026-06-11 10:30:00'
      ],
      [
        'Accessibility (a11y) Testing Checklist',
        '<h2>Why Accessibility Testing?</h2><p>Accessibility ensures our product is usable by people with disabilities. It is also a legal requirement in many regions (WCAG 2.1 AA is the standard we target).</p><h2>Automated Checks</h2><p>Use <strong>axe-core</strong> integrated with Playwright for automated a11y scanning:</p><pre>import { checkA11y } from "axe-playwright";\n\ntest("Dashboard has no a11y violations", async ({ page }) => {\n  await page.goto("/dashboard");\n  await checkA11y(page);\n});</pre><p>Note: Automated tools catch 30-40% of a11y issues. Manual testing is still required.</p><h2>Manual Checklist</h2><h3>Keyboard Navigation</h3><ul><li>All interactive elements reachable by Tab key</li><li>Focus order is logical (top-to-bottom, left-to-right)</li><li>Focus indicator is clearly visible</li><li>Modal traps focus inside when open; restores focus on close</li><li>Dropdown menus operable with arrow keys and Escape</li></ul><h3>Screen Reader (NVDA / VoiceOver)</h3><ul><li>All images have descriptive alt text</li><li>Form labels are programmatically associated with inputs</li><li>Error messages announced when form validation fails</li><li>Page title updates on route change (SPA)</li></ul><h3>Visual</h3><ul><li>Colour contrast ratio 4.5:1 for normal text, 3:1 for large text</li><li>No information conveyed by colour alone</li><li>Text resizable to 200% without horizontal scroll</li></ul>',
        'Best Practices', 3, 'published', 'accessibility,a11y,WCAG,screen reader,axe',
        '2026-06-12 10:00:00', '2026-06-12 10:00:00'
      ],
    ];

    for (const article of kbArticles) {
      insertKb.run(...article);
    }
    console.log('Knowledge base articles seeded.');
  }

  console.log('Database initialization complete.');
}

export default db;
