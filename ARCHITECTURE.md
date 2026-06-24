# Qlarity QA Asset Management Platform — Architecture & Technical Reference

> **Status:** Living document. Last updated against branch `claude/loving-wright-KSSbB`.
> Written from direct codebase inspection — not aspirational, reflects actual implementation.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project Structure](#2-project-structure)
3. [Technology Stack](#3-technology-stack)
4. [Backend Architecture](#4-backend-architecture)
5. [API Reference](#5-api-reference)
6. [Database Schema](#6-database-schema)
7. [File Storage & Encryption](#7-file-storage--encryption)
8. [Authentication & Sessions](#8-authentication--sessions)
9. [Role-Based Access Control (RBAC)](#9-role-based-access-control-rbac)
10. [Notifications System](#10-notifications-system)
11. [Frontend Architecture](#11-frontend-architecture)
12. [Security Model](#12-security-model)
13. [Environment Variables](#13-environment-variables)
14. [Dependencies](#14-dependencies)
15. [Running the Project](#15-running-the-project)
16. [Known Limitations & Tech Debt](#16-known-limitations--tech-debt)

---

## 1. Overview

Qlarity is a multi-tenant QA asset management platform. It provides document lifecycle management (upload → review → approval → publish), a knowledge base, test data library, approval workflows, audit logging, and real-time notifications — scoped per organisation.

**Key design decisions:**
- **Multi-tenancy via `organization_id`** on every table (row-level isolation, no separate DB per tenant)
- **Encrypted at rest** — AES-256-GCM with a magic-header scheme for backwards compatibility
- **RBAC** combines built-in roles (admin/lead/engineer/viewer) with per-org custom roles stored in JSONB
- **Real-time** via WebSocket + BullMQ queue (notifications, no polling required)

---

## 2. Project Structure

```
QA-project/
├── backend/
│   └── src/
│       ├── index.ts            # Express app entry, middleware chain, route registration
│       ├── db.ts               # PostgreSQL client (postgres driver, pool=10)
│       ├── redis.ts            # Redis wrapper (ioredis, lazy-connect, graceful fallback)
│       ├── queue.ts            # BullMQ notification queue & worker (concurrency=5)
│       ├── wsServer.ts         # WebSocket server (JWT auth, user registry, push helper)
│       ├── fileEncryption.ts   # AES-256-GCM encrypt/decrypt, QLENC1 magic header
│       ├── emailService.ts     # Resend email (7 templates, console fallback in dev)
│       ├── initDb.ts           # Schema creation, seed data, directory setup
│       ├── middleware/
│       │   └── auth.ts         # authenticate, requireRole, requireModule middleware
│       ├── types.ts            # TypeScript interfaces (User, FileRecord, JwtPayload…)
│       └── routes/
│           ├── auth.ts         # /api/auth — login, register, refresh, reset-password
│           ├── files.ts        # /api/files — upload, checkout, approve, versions, diff
│           ├── users.ts        # /api/users — CRUD, avatar, preferences, mention-search
│           ├── knowledge.ts    # /api/knowledge — articles CRUD
│           ├── repositories.ts # /api/repositories — hierarchical repo tree
│           ├── folders.ts      # /api/folders — file folder hierarchy
│           ├── templates.ts    # /api/templates — file templates
│           ├── notifications.ts# /api/notifications — list, mark-read
│           ├── search.ts       # /api/search — FTS across files + knowledge
│           ├── audit.ts        # /api/audit — audit log, CSV export
│           ├── categories.ts   # /api/categories — per-org tag categories
│           ├── orgSettings.ts  # /api/org-settings — RBAC config, custom roles
│           ├── dashboard.ts    # /api/dashboard — stats (Redis cached), activity feed
│           └── backoffice.ts   # /api/backoffice — platform admin interface
├── frontend/
│   └── src/
│       ├── App.tsx             # BrowserRouter, ProtectedRoute, all routes
│       ├── api/client.ts       # Axios instance (withCredentials, 401 interceptor)
│       ├── context/
│       │   ├── AuthContext.tsx       # user state, login/logout, isAdmin/isLead/isEngineer
│       │   ├── PermissionsContext.tsx# RBAC module access, custom role merging
│       │   ├── ThemeContext.tsx      # light/dark/system, localStorage persistence
│       │   ├── LogoutContext.tsx     # logout event broadcast
│       │   └── BackofficeAuthContext.tsx # Separate auth for platform admins
│       ├── pages/              # 16 main pages + 4 backoffice pages
│       ├── components/
│       │   ├── Layout/         # AppLayout, Sidebar, TopBar, Footer
│       │   └── UI/             # Modal, Pagination, FolderTree, DiffViewer, MentionInput…
│       └── hooks/
│           └── useNotificationSocket.ts # WS connection with exponential backoff reconnect
├── uploads/                    # Encrypted file storage (auto-created on startup)
│   └── templates/              # File template copies
├── docker-compose.yml          # PostgreSQL 16, Redis 7, backend, frontend, nginx
├── nginx.conf                  # Reverse proxy (/ → frontend, /api/ → backend:3001, /ws → ws)
└── .env.example                # All supported environment variables with descriptions
```

---

## 3. Technology Stack

| Layer | Technology | Version |
|---|---|---|
| Backend runtime | Node.js + TypeScript | TS 5.3.3 |
| Backend framework | Express.js | 4.18.2 |
| Database | PostgreSQL | 16 (docker) |
| DB driver | postgres (pg3) | 3.4.9 |
| Cache / Queue | Redis + BullMQ | Redis 6.x+, BullMQ 5.78.1 |
| WebSocket | ws | 8.21.0 |
| Auth | jsonwebtoken + bcryptjs | 9.0.2 / 2.4.3 |
| File handling | multer + archiver + diff | 1.4.5 / 8.0.0 / 9.0.0 |
| Email | Resend.com (resend) | via API key |
| Frontend | React 18 + TypeScript | 18.2.0 / 5.3.3 |
| Build tool | Vite | 5.0.12 |
| Routing | React Router | 6.21.3 |
| Styling | Tailwind CSS | 3.4.1 |
| Charts | Recharts | 2.10.4 |
| Icons | Lucide React | 0.316.0 |
| Toasts | Sonner | 2.0.7 |
| 3D scene | @splinetool/react-spline | 4.1.0 |

---

## 4. Backend Architecture

### 4.1 Startup & Middleware Chain

`backend/src/index.ts` wires up the following in order:

```
1. Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection,
                    Referrer-Policy, Permissions-Policy, Content-Security-Policy)
2. CORS (ALLOWED_ORIGINS whitelist, credentials: true)
3. Cookie parser
4. JSON body parser (50MB limit)
5. Global rate limiter (200 req / 15min)
6. Auth rate limiter (20 req / 15min in prod, 200 in dev) — applied to /api/auth/*
7. Route handlers
8. WebSocket server (http.createServer wraps Express, /ws upgrade)
```

Server listens on `PORT` env var (default **3001**).

### 4.2 WebSocket Server (`wsServer.ts`)

- Runs on the same HTTP server as Express (no separate port)
- Authenticates clients on connection via JWT (query string `?token=` or httpOnly cookie)
- Maintains a `Map<userId, Set<WebSocket>>` registry — supports multiple tabs per user
- `pushToUser(userId, payload)` broadcasts to all active sockets for that user
- Messages are **server → client only** (no client-sent messages processed)
- Frontend reconnects with exponential backoff: 1s → 2s → 4s … capped at 30s

### 4.3 Queue & Worker (`queue.ts`)

- BullMQ queue named `'notifications'` (backed by Redis)
- Worker: concurrency=5, processes jobs immediately
- Each job: `{ userId, type, title, message, organizationId }`
- Worker writes to `notifications` table, then calls `pushToUser()` for real-time delivery

### 4.4 Database Connection (`db.ts`)

- Driver: `postgres` (pg3, **not** pg/node-postgres)
- Connection pool: max 10 connections
- All queries use tagged template literals (parameterised by the driver, no SQL injection risk)
- Connection string from `DATABASE_URL` env var

### 4.5 Redis (`redis.ts`)

- ioredis with `lazyConnect: true`
- On connection failure: logs warning, operations fall through (dashboard falls back to live DB queries)
- Used for: dashboard stats cache (60s TTL), BullMQ queue storage

---

## 5. API Reference

All routes are prefixed `/api/`. Authentication is via httpOnly `accessToken` cookie.

### 5.1 Auth (`/api/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/login` | — | Email+password → sets httpOnly cookies (accessToken 8h, refreshToken 7d) |
| POST | `/refresh` | refreshToken cookie | Issue new accessToken, rotate refreshToken |
| GET | `/me` | ✓ | Current user + org info (slug, name, plan) |
| POST | `/logout` | ✓ | Clear cookies, revoke refreshToken in DB |
| POST | `/change-password` | ✓ | Verify current password, set new (min 8 chars) |
| POST | `/forgot-password` | — | Send reset link (1-hour expiry) via Resend |
| POST | `/reset-password` | — | Consume token, set new password |
| GET | `/reset-password/validate` | — | Check token validity (not expired/used) |
| POST | `/register` | — | Create org + first admin user (plan: free/pro/enterprise) |
| GET | `/orgs` | ✓ | Orgs the current user belongs to (for org switcher) |
| POST | `/switch-org` | ✓ | Swap active org context, reissue tokens |

**Rate limiting on login:** 20 failed attempts per IP + 20 per email in 15 minutes → 429. Tracked in `audit_logs` table (not Redis).

### 5.2 Files (`/api/files`)

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET | `/` | viewer | List files (org-scoped). Params: `status`, `project`, `category`, `folder_id`, `search`, `limit`, `offset` |
| GET | `/search` | viewer | Full-text search across name/description/tags/project/jira_ticket |
| GET | `/export` | lead | CSV export of file list |
| POST | `/bulk-action` | engineer | Batch status/category changes |
| POST | `/bulk-download` | viewer | ZIP download of multiple files (on-the-fly, decrypted) |
| POST | `/bulk-submit` | engineer | Submit multiple files for review |
| POST | `/upload` | engineer | Single-file upload (multer, max 50MB). Auto-encrypts AES-256-GCM |
| POST | `/bulk-upload` | engineer | Up to 20 files at once |
| GET | `/:id` | viewer | File metadata + versions list + approvals |
| PUT | `/:id` | engineer | Update name/project/category/description/tags |
| DELETE | `/:id` | admin | Permanent delete (cascades: versions, approvals, comments) |
| GET | `/:id/download` | viewer | Download (decrypted), logs DOWNLOAD to audit |
| GET | `/:id/preview` | viewer | Preview (JPEG/PNG/GIF/WEBP/BMP/PDF only) |
| POST | `/:id/checkout` | engineer | Lock for editing (409 if another user holds lock) |
| POST | `/:id/checkin` | engineer | Release lock |
| POST | `/:id/submit` | engineer | Submit for review — emails leads/admins, creates approval records |
| POST | `/:id/approve` | lead | Advance approval state (draft→submitted→under_review→approved→published) |
| POST | `/:id/archive` | lead | Set status=archived |
| POST | `/:id/restore` | lead | Restore archived → draft |
| GET | `/:id/versions` | viewer | Version history |
| GET | `/:id/versions/diff` | viewer | Unified diff between two versions (text only, max 2MB each) |
| GET | `/:id/versions/:v/download` | viewer | Download specific version |
| GET | `/:id/comments` | viewer | List comments |
| POST | `/:id/comments` | engineer | Add comment (max 2000 chars). Parses @mentions → creates notifications |
| DELETE | `/:id/comments/:cid` | engineer | Delete own comment |
| GET | `/:id/approvals` | viewer | Approval chain |

**File status state machine:**
```
draft ──submit──► submitted ──review──► under_review
  ▲                                          │
  └───────────── reject (return to draft) ◄──┤
                                             │
                                         approve
                                             │
                                      approved/published
```

**Storage limits by plan:**
- `free`: 1 GB per org
- `pro`: 50 GB per org
- `enterprise`: unlimited

### 5.3 Users (`/api/users`)

| Method | Path | Min Role | Description |
|---|---|---|---|
| GET | `/` | engineer | List org users (paginated) |
| GET | `/me` | viewer | Own profile |
| PATCH | `/me/preferences` | viewer | Save UI preferences (JSON) |
| PUT | `/me/avatar` | viewer | Upload avatar (JPG/PNG/GIF/WEBP, max 2MB) |
| GET | `/mention-search?q=` | engineer | Autocomplete for @mentions in comments |
| GET | `/:id` | engineer | User detail |
| POST | `/` | admin | Create user |
| PUT | `/:id` | admin | Update user (name/email/role/department), sends role-change email |
| PUT | `/:id/activate` | admin | Reactivate deactivated user |
| PUT | `/:id/deactivate` | admin | Deactivate user (cannot self-deactivate) |
| DELETE | `/:id` | admin | Delete user |
| GET | `/:id/avatar` | viewer | Retrieve avatar image |

### 5.4 Other Routes (summary)

| Prefix | Description |
|---|---|
| `/api/knowledge` | KB articles CRUD (draft/published, HTML content, sanitized before storage) |
| `/api/repositories` | Hierarchical repo tree (name, description, required_approvals, file counts) |
| `/api/folders` | File folder hierarchy (parent_id self-reference, RBAC: engineer create, lead delete) |
| `/api/templates` | File templates (copies of encrypted files; create-from-template generates new file) |
| `/api/notifications` | List, mark-read, mark-all-read |
| `/api/search` | Global FTS (files + knowledge), suggestions autocomplete |
| `/api/audit` | Audit log list + CSV export (admin only, max 5000 rows export) |
| `/api/categories` | Per-org file/knowledge categories (engineer create, admin delete) |
| `/api/org-settings` | RBAC permissions CRUD, custom role management |
| `/api/dashboard` | Stats (Redis 60s cache), activity feed (admin only) |
| `/api/backoffice` | Platform admin: org/user management, plan changes, platform stats |
| `GET /api/health` | Health check (no auth) |

---

## 6. Database Schema

Database: **PostgreSQL 16**, auto-migrated on startup via `initDb()` (`ALTER TABLE … ADD COLUMN IF NOT EXISTS` pattern — safe to run on existing DBs).

### 6.1 Tables

#### `organizations`
```sql
id          SERIAL PRIMARY KEY
name        TEXT NOT NULL
slug        TEXT UNIQUE NOT NULL          -- lowercase, 2-50 chars, [a-z0-9-]
plan        TEXT DEFAULT 'free'           -- 'free' | 'pro' | 'enterprise'
active      BOOLEAN DEFAULT TRUE
archived_at TIMESTAMPTZ                   -- soft delete
role_permissions  JSONB DEFAULT '{}'      -- custom role definitions per org
created_at  TIMESTAMPTZ DEFAULT NOW()
```
*Platform-level table — NOT org-scoped.*

#### `platform_admins`
```sql
id           SERIAL PRIMARY KEY
name         TEXT NOT NULL
email        TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
active       BOOLEAN DEFAULT TRUE
last_login   TIMESTAMPTZ
created_at   TIMESTAMPTZ DEFAULT NOW()
```
*Seeded: `platform@qlarity.com` / `PlatformAdmin123!`*

#### `users`
```sql
id              SERIAL PRIMARY KEY
name            TEXT NOT NULL
email           TEXT NOT NULL
password_hash   TEXT NOT NULL
role            TEXT DEFAULT 'viewer'      -- 'admin'|'lead'|'engineer'|'viewer'|custom
department      TEXT
avatar          TEXT                       -- stored filename (./uploads/avatars/)
active          BOOLEAN DEFAULT TRUE
preferences     JSONB DEFAULT '{}'         -- notification prefs etc
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
last_login      TIMESTAMPTZ

UNIQUE (email, organization_id)           -- email unique per org, not globally
```
*Seeded demo users: admin/lead/engineer1/engineer2/viewer @qa.com (password: `password123`)*

#### `files`
```sql
id              SERIAL PRIMARY KEY
name            TEXT NOT NULL
original_name   TEXT NOT NULL
path            TEXT NOT NULL              -- relative path under ./uploads/
size            BIGINT                     -- bytes (encrypted ciphertext size)
mime_type       TEXT
repository_id   INTEGER REFERENCES repositories(id)
owner_id        INTEGER REFERENCES users(id)
version         INTEGER DEFAULT 1          -- incremented on each checkin
status          TEXT DEFAULT 'draft'       -- draft|submitted|under_review|approved|published|archived
project         TEXT
module          TEXT
category        TEXT
jira_ticket     TEXT
tags            TEXT
description     TEXT
folder_id       INTEGER REFERENCES file_folders(id) ON DELETE SET NULL
checked_out_by  INTEGER REFERENCES users(id)
checked_out_at  TIMESTAMPTZ
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```
*FTS index: `idx_files_fts` on `(name || ' ' || COALESCE(description,'') || ' ' || COALESCE(tags,'') || ' ' || COALESCE(project,'') || ' ' || COALESCE(jira_ticket,''))`*

#### `file_versions`
```sql
id              SERIAL PRIMARY KEY
file_id         INTEGER REFERENCES files(id) ON DELETE CASCADE
version         INTEGER NOT NULL
path            TEXT NOT NULL              -- snapshot copy under ./uploads/
size            BIGINT
change_log      TEXT
created_by      INTEGER REFERENCES users(id)
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `file_folders`
```sql
id              SERIAL PRIMARY KEY
name            TEXT NOT NULL
parent_id       INTEGER REFERENCES file_folders(id) ON DELETE CASCADE  -- self-reference
organization_id INTEGER REFERENCES organizations(id)
created_by      INTEGER REFERENCES users(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

INDEX idx_file_folders_org    (organization_id)
INDEX idx_file_folders_parent (parent_id)
```

#### `file_templates`
```sql
id              SERIAL PRIMARY KEY
name            TEXT NOT NULL
description     TEXT
source_file_id  INTEGER REFERENCES files(id) ON DELETE SET NULL
path            TEXT NOT NULL              -- under ./uploads/templates/
mime_type       TEXT
size            BIGINT
category        TEXT
tags            TEXT
created_by      INTEGER REFERENCES users(id)
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()

INDEX idx_file_templates_org (organization_id)
```

#### `repositories`
```sql
id                  SERIAL PRIMARY KEY
name                TEXT NOT NULL
description         TEXT
parent_id           INTEGER REFERENCES repositories(id)  -- self-reference for nesting
type                TEXT DEFAULT 'folder'   -- 'folder' | 'repo'
project             TEXT
owner_id            INTEGER REFERENCES users(id)
required_approvals  INTEGER DEFAULT 1
organization_id     INTEGER REFERENCES organizations(id)
created_at          TIMESTAMPTZ DEFAULT NOW()
```

#### `approvals`
```sql
id              SERIAL PRIMARY KEY
file_id         INTEGER REFERENCES files(id) ON DELETE CASCADE
reviewer_id     INTEGER REFERENCES users(id)
status          TEXT DEFAULT 'pending'     -- 'pending' | 'approved'
comments        TEXT
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `knowledge_articles`
```sql
id              SERIAL PRIMARY KEY
title           TEXT NOT NULL
content         TEXT                       -- HTML (sanitized before storage)
category        TEXT
author_id       INTEGER REFERENCES users(id)
status          TEXT DEFAULT 'draft'       -- 'draft' | 'published' | 'archived'
tags            TEXT
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```
*FTS index: `idx_kb_fts` on `(title || ' ' || COALESCE(tags,'') || ' ' || COALESCE(category,''))`*

#### `notifications`
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE
type            TEXT                       -- 'info' | 'approval' | 'mention' etc
title           TEXT
message         TEXT
read            BOOLEAN DEFAULT FALSE
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `audit_logs`
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id)
action          TEXT                       -- LOGIN | LOGIN_FAIL | UPLOAD | DOWNLOAD |
                                           -- APPROVE | ARCHIVE | RESTORE | DELETE |
                                           -- VIEW | CHECKIN | CHECKOUT | etc
entity_type     TEXT                       -- 'file' | 'user' | 'knowledge' | etc
entity_id       INTEGER
details         TEXT
ip_address      TEXT
organization_id INTEGER                    -- nullable (platform-level events)
created_at      TIMESTAMPTZ DEFAULT NOW()
```
*No indexes on this table — queries filtered by `organization_id + action + user_id + date` (full scan on large tables).*

#### `file_comments`
```sql
id              SERIAL PRIMARY KEY
file_id         INTEGER REFERENCES files(id) ON DELETE CASCADE
user_id         INTEGER REFERENCES users(id)
comment         TEXT NOT NULL              -- max 2000 chars enforced in API
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `categories`
```sql
id              SERIAL PRIMARY KEY
name            TEXT NOT NULL
type            TEXT NOT NULL              -- 'file' | 'knowledge'
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()

UNIQUE (name, type, organization_id)
```

#### `password_reset_tokens`
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE
token           TEXT UNIQUE NOT NULL
expires_at      TIMESTAMPTZ NOT NULL       -- 1-hour window
used            BOOLEAN DEFAULT FALSE
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### `refresh_tokens`
```sql
id              SERIAL PRIMARY KEY
user_id         INTEGER REFERENCES users(id) ON DELETE CASCADE
token           TEXT UNIQUE NOT NULL       -- 64-byte random hex
expires_at      TIMESTAMPTZ NOT NULL       -- 7-day window
revoked         BOOLEAN DEFAULT FALSE
organization_id INTEGER REFERENCES organizations(id)
created_at      TIMESTAMPTZ DEFAULT NOW()
```

---

## 7. File Storage & Encryption

### 7.1 Encryption Scheme

Files are encrypted **after upload** using AES-256-GCM authenticated encryption (Node.js built-in `crypto` module).

**On-disk binary layout:**
```
[ QLENC1 ] [ 12-byte IV ] [ 16-byte GCM auth tag ] [ N-byte ciphertext ]
  6 bytes     random          from encrypt              encrypted file data
```

- Magic header `QLENC1` allows distinguishing encrypted files from legacy plaintext files
- Key source: `FILE_ENCRYPTION_KEY` env var (must be exactly 64 hex chars = 32 bytes)
- Each file gets a unique random IV (nonce) — re-used IVs with AES-GCM are catastrophic, so uniqueness is critical
- Decryption verifies the GCM auth tag (detects tampering)
- **Legacy files** (no `QLENC1` header) are served as-is with a console warning

**If `FILE_ENCRYPTION_KEY` is not set:** Files are stored plaintext, a one-time warning is logged. This is the current default in dev.

### 7.2 File Lifecycle

```
Upload request (multipart/form-data)
       │
       ▼
Multer saves to ./uploads/ as {timestamp}-{sanitized_name}
       │
       ▼
encryptFile() — read plaintext, write QLENC1 + IV + tag + ciphertext, delete plaintext
       │
       ▼
DB insert: files row (path, size, mime_type, owner_id, organization_id…)
       │
       ▼
audit_logs INSERT (action=UPLOAD)

Download request
       │
       ▼
authenticate → check org ownership → decryptFileToBuffer()
       │
       ▼
res.send(plaintext buffer) + Content-Disposition header
       │
       ▼
audit_logs INSERT (action=DOWNLOAD)
```

### 7.3 Version Snapshots

On file checkin/update, the previous version's encrypted file is **copied** (not moved) to a new path, and a `file_versions` row is inserted. The original path keeps the latest version. Diffs are computed by decrypting both versions into memory (limited to 2MB per file for text-only formats).

### 7.4 Storage Layout

```
uploads/
├── {timestamp}-{name}.ext        # current file versions (encrypted)
├── {timestamp}-{name}-v2.ext     # older versions (encrypted snapshots)
├── avatars/
│   └── avatar-{userId}.jpg       # user avatars (not encrypted)
└── templates/
    └── {timestamp}-{name}.ext    # template copies (encrypted)
```

---

## 8. Authentication & Sessions

### 8.1 Login Flow

```
POST /api/auth/login  { email, password, orgSlug? }
       │
       ├── Check IP rate limit (20 fails/15min)
       ├── Check email rate limit (20 fails/15min)
       ├── Lookup user by (email, org)
       ├── bcrypt.compare(password, hash)                  ← 10 salt rounds
       │
       ├── On success:
       │   ├── Sign JWT: { userId, email, role, organizationId }  HS256, expires 8h
       │   ├── Generate refreshToken: 64-byte crypto.randomBytes, store in refresh_tokens
       │   ├── Set httpOnly cookies:
       │   │   ├── accessToken  (httpOnly, secure in prod, sameSite=strict, path=/)
       │   │   └── refreshToken (httpOnly, secure in prod, sameSite=strict, path=/api/auth)
       │   ├── Update users.last_login
       │   └── INSERT audit_logs (action=LOGIN)
       │
       └── On failure:
           └── INSERT audit_logs (action=LOGIN_FAIL)
```

### 8.2 Token Refresh

- Frontend Axios interceptor catches 401 responses
- Queues in-flight requests, calls `POST /api/auth/refresh`
- Backend validates refresh token (not revoked, not expired, user still active)
- Issues new access token + new refresh token, revokes old refresh token
- If refresh fails → redirect to `/login`

### 8.3 Auth Middleware

```typescript
// backend/src/middleware/auth.ts

authenticate        // Verify JWT from cookie or Authorization: Bearer header
requireRole(...r)   // Must have one of the specified roles (admin always passes)
requireModule(m)    // For custom roles: check organizations.role_permissions[role][m]
```

### 8.4 Multi-Tenancy Guard

JWT claims include `organizationId`. All authenticated routes filter DB queries by `req.user.organizationId`. If a JWT lacks `organizationId` (old session before migration), the backend returns 401 to force re-login.

---

## 9. Role-Based Access Control (RBAC)

### 9.1 Built-in Roles

| Role | Modules | Key Restrictions |
|---|---|---|
| **admin** | All modules | Full access, bypasses all `requireRole` and `requireModule` checks |
| **lead** | All except audit/users/orgSettings | Can approve files, delete archived files, manage repos |
| **engineer** | dashboard, repositories, files, search, knowledge, testData, settings | Cannot approve, archive/delete files, manage users |
| **viewer** | Same as engineer | Read-only — no upload, no edit, no submit |

### 9.2 Custom Roles

Admins can create custom roles via **Settings → RBAC**:

1. Role is stored under `organizations.role_permissions` JSONB:
   ```json
   {
     "qa_analyst": {
       "dashboard": true,
       "files": true,
       "knowledge": false,
       "__moduleCleared": true
     }
   }
   ```
2. `__moduleCleared: true` flag tells the backend this is a custom role (not a built-in)
3. Frontend fetches permissions via `GET /org-settings/permissions`, merges hardcoded defaults with DB custom roles
4. Backend `requireModule(m)` middleware: looks up `role_permissions[user.role][m]` for custom roles

### 9.3 Module Keys

```
'dashboard' | 'repositories' | 'files' | 'search' | 'knowledge' |
'testData'  | 'approvals'    | 'archive' | 'audit' | 'users'    |
'settings'  | 'orgSettings'
```

### 9.4 Approval Hierarchy

Repositories have a `required_approvals` field (default 1). When a file is approved:
- Count existing `approvals` where `status = 'approved'` (excluding current reviewer)
- If `count + 1 < required_approvals` → status stays `under_review`
- If threshold met → status advances to `approved` (and emails file owner)

---

## 10. Notifications System

### 10.1 Architecture

```
Application code
       │ notificationQueue.add('notify', { userId, type, title, message, organizationId })
       ▼
BullMQ queue ('notifications') ── backed by Redis
       │ Worker picks up job (concurrency=5)
       ▼
INSERT into notifications table
       │
       └── pushToUser(userId, { type: 'notification', notification: row })
                  │
                  ▼
          WebSocket registry: Map<userId, Set<WebSocket>>
                  │
                  ▼
          Client receives message → useNotificationSocket callback
                  │
                  ▼
          UI updates notification bell (badge count, dropdown)
```

### 10.2 Notification Triggers

| Action | Recipient | Channel |
|---|---|---|
| File submitted for review | All leads + admins in org | WebSocket + Email |
| File approved | File owner | WebSocket + Email |
| File rejected (returned to draft) | File owner | WebSocket + Email |
| File published | File owner | WebSocket + Email |
| @mention in a comment | Mentioned user | WebSocket (no email) |
| Role changed | Affected user | Email only |
| Welcome (new org created) | Admin user | Email only |
| Password reset | User | Email only |

### 10.3 Email Provider

- Primary: Resend.com (`RESEND_API_KEY`)
- Fallback: Console logging (dev) — no emails actually sent
- Legacy SMTP: Code exists in `mailer.ts` but not wired into the main flow

---

## 11. Frontend Architecture

### 11.1 Routing

`App.tsx` uses `BrowserRouter` with a `<ProtectedRoute>` component that checks `AuthContext.user`. Unauthorised access redirects to `/login`.

| Route | Component | Min Role |
|---|---|---|
| `/login` | Login.tsx | public |
| `/register` | Register.tsx | public |
| `/forgot-password` | ForgotPassword.tsx | public |
| `/reset-password` | ResetPassword.tsx | public |
| `/` | Dashboard.tsx | viewer |
| `/repositories` | Repositories.tsx | viewer |
| `/files` | FileManager.tsx | viewer |
| `/search` | SearchResults.tsx | viewer |
| `/knowledge` | KnowledgeBase.tsx | viewer |
| `/test-data` | TestDataLibrary.tsx | viewer |
| `/approvals` | ApprovalWorkflow.tsx | lead |
| `/archive` | Archive.tsx | admin |
| `/audit` | AuditLog.tsx | admin |
| `/users` | UserManagement.tsx | admin |
| `/settings` | Settings.tsx | viewer |
| `/org-settings` | OrgSettings.tsx | admin |
| `/backoffice/*` | Backoffice* | platform admin |

### 11.2 Context Providers

```tsx
<ThemeContext>           // dark/light/system mode
  <AuthContext>          // user state, login/logout, isAdmin/isLead/isEngineer
    <PermissionsContext> // RBAC module access map
      <LogoutContext>    // logout broadcast event
        <App />
      </LogoutContext>
    </PermissionsContext>
  </AuthContext>
</ThemeContext>
```

### 11.3 API Client (`api/client.ts`)

- Axios instance, `baseURL: '/api'`, `withCredentials: true`
- **Request interceptor:** Ensures `withCredentials` on every call
- **Response interceptor:**
  - On 401: Queue all in-flight requests, attempt `POST /auth/refresh` once
  - If refresh succeeds: Retry all queued requests
  - If refresh fails: Clear queue, redirect to `/login`

### 11.4 Key UI Components

| Component | Description |
|---|---|
| `FolderTree` | Recursive hierarchical folder browser with ARIA menu roles, inline rename, context menu |
| `MentionInput` | Textarea with @mention autocomplete (debounced 200ms, AbortController for stale requests, mounted-guard) |
| `DiffViewer` | Unified diff renderer with line numbers and colour-coded +/- lines |
| `Pagination` | Offset-based page control (limit/offset pattern) |
| `ConfirmModal` | Reusable destructive-action confirmation dialog |
| `Modal` | Portal-based modal with size variants (sm/md/lg/xl) |
| `FileIcon` | MIME-type → icon mapping |
| `EmptyState` | Consistent empty-state placeholder with icon + text |
| `StatusBadge` | Colour-coded file status pill (draft/submitted/under_review/approved/published/archived) |

---

## 12. Security Model

### 12.1 What's Well Implemented

| Control | Implementation |
|---|---|
| **Authentication** | bcrypt (cost 10), httpOnly cookies, JWT HS256, refresh token rotation |
| **CSRF protection** | sameSite=strict cookies (no explicit CSRF tokens — relies on browser same-site enforcement) |
| **SQL injection** | Parameterised queries via `postgres` driver tagged templates throughout |
| **Security headers** | X-Frame-Options: DENY, nosniff, XSS protection, strict CSP, Permissions-Policy |
| **Rate limiting** | Per-IP + per-email login failure tracking, 200 req/15min global |
| **File encryption** | AES-256-GCM at rest, unique IV per file, GCM auth tag validates integrity |
| **CORS** | Origin whitelist, no wildcard |
| **Input validation** | Email regex, slug regex, password min-length, comment max-length |
| **Multi-tenancy isolation** | Every query filters by `organization_id` from JWT (not from request body) |
| **Audit trail** | All sensitive actions logged to `audit_logs` with IP |
| **HTML sanitisation** | KB articles: allowlist-based DOM parser strips disallowed tags and attributes |

### 12.2 Honest Limitations & Gaps

| Area | Issue |
|---|---|
| **Encryption key rotation** | No built-in rotation — to rotate the key you must decrypt all files and re-encrypt manually |
| **Audit log indexes** | No indexes on `audit_logs` — full table scans on large deployments |
| **Session idle timeout** | Refresh tokens last 7 days regardless of inactivity |
| **Rate limiting on uploads** | Bulk upload (up to 20 files) is not rate-limited per user — only the global 200/15min applies |
| **HTML sanitisation coverage** | Regex-based stripping of `<script>` / `on*` attributes alongside DOM-based allowlist — the DOM approach is good, but legacy regex code remains |
| **WebSocket message validation** | No schema validation on incoming WS messages (harmless today, since they are ignored) |
| **PDF preview security** | PDF files are proxied directly to browser — complex PDFs with embedded JavaScript may present XSS risk depending on browser version |
| **`is_archived` column bug** | `search.ts` references `is_archived` column which does not exist (should be `status != 'archived'`) — full-text search may error on some queries |
| **File size in DB** | `size` column stores encrypted ciphertext size (slightly larger than plaintext due to IV + tag overhead) — not the original file size |
| **No PBKDF on FILE_ENCRYPTION_KEY** | Key is used raw from env var — no KDF applied; key strength depends entirely on the operator |

### 12.3 Deployment Checklist

- [ ] Set `JWT_SECRET` to 48+ byte random hex
- [ ] Set `FILE_ENCRYPTION_KEY` to exactly 64 hex chars (32 bytes)
- [ ] Set `RESEND_API_KEY` for email delivery
- [ ] Set `NODE_ENV=production` (enables secure cookies, tighter rate limits)
- [ ] Set `ALLOWED_ORIGINS` to your domain(s) only
- [ ] Set `TRUST_PROXY=1` if behind nginx/load balancer (correct IP capture)
- [ ] Change default demo user passwords immediately
- [ ] Change platform admin password (`platform@qlarity.com`)
- [ ] Point `DATABASE_URL` and `REDIS_URL` to production services
- [ ] Ensure `./uploads` is on persistent storage (not ephemeral container volume)
- [ ] Back up `FILE_ENCRYPTION_KEY` securely — losing it = losing all encrypted files

---

## 13. Environment Variables

### Required in Production

| Variable | Description |
|---|---|
| `JWT_SECRET` | HS256 signing key. Min 48 bytes of randomness (`openssl rand -hex 32`) |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://user:pass@host:5432/dbname`) |
| `REDIS_URL` | Redis URL (`redis://host:6379` or `redis://:password@host:port/0`) |

### Strongly Recommended

| Variable | Default | Description |
|---|---|---|
| `FILE_ENCRYPTION_KEY` | — (plaintext if unset) | 64 hex chars for AES-256-GCM. Required for at-rest encryption |
| `RESEND_API_KEY` | — (console fallback) | Resend.com API key for email delivery |
| `EMAIL_FROM` | `Qlarity <onboarding@resend.dev>` | Sender address |
| `APP_URL` | `http://localhost:5173` | Base URL for email links |

### Optional

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Backend HTTP server port |
| `NODE_ENV` | `development` | `production` enables secure cookies + tighter rate limits |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:4173` | CORS origin whitelist |
| `TRUST_PROXY` | `0` | Set to `1` when behind nginx/ALB/CDN |
| `UPLOAD_DIR` | `./uploads` | Directory for encrypted file storage |
| `MAX_FILE_SIZE_MB` | `50` | Per-file upload size limit |
| `JWT_EXPIRES_IN` | `8h` | Access token TTL |

---

## 14. Dependencies

### Backend

```json
{
  "express": "4.18.2",
  "jsonwebtoken": "9.0.2",
  "bcryptjs": "2.4.3",
  "postgres": "3.4.9",
  "ioredis": "5.11.1",
  "bullmq": "5.78.1",
  "ws": "8.21.0",
  "multer": "1.4.5-lts.1",
  "archiver": "8.0.0",
  "diff": "9.0.0",
  "cors": "2.8.5",
  "cookie-parser": "1.4.7",
  "express-rate-limit": "8.5.2",
  "dotenv": "16.4.1"
}
```

`crypto` module is built-in Node.js — no external crypto library for AES-256-GCM.

### Frontend

```json
{
  "react": "18.2.0",
  "react-router-dom": "6.21.3",
  "axios": "1.6.7",
  "tailwindcss": "3.4.1",
  "recharts": "2.10.4",
  "lucide-react": "0.316.0",
  "sonner": "2.0.7",
  "date-fns": "3.3.1",
  "clsx": "2.1.1",
  "tailwind-merge": "3.6.0",
  "@splinetool/react-spline": "4.1.0"
}
```

---

## 15. Running the Project

### Local Development

**Prerequisites:** Node.js 20+, PostgreSQL 16, Redis 6.2+

```bash
# 1. Clone and install
git clone <repo>
cd QA-project
npm install        # installs root + all workspaces

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL, REDIS_URL at minimum

# 3. Start everything (concurrently runs backend + frontend)
npm run dev

# Backend: http://localhost:3001
# Frontend: http://localhost:5173
```

Database schema and seed data are created automatically on first backend startup.

**Demo credentials (change immediately):**
| Email | Password | Role |
|---|---|---|
| admin@qa.com | password123 | Admin |
| lead@qa.com | password123 | Lead |
| engineer1@qa.com | password123 | Engineer |
| engineer2@qa.com | password123 | Engineer |
| viewer@qa.com | password123 | Viewer |
| platform@qlarity.com | PlatformAdmin123! | Platform admin |

### Docker (Production-like)

```bash
docker-compose up -d
# Services: postgres, redis, backend (3001), frontend (80)
# Nginx proxies: / → frontend, /api/ → backend, /ws → websocket
```

### Build

```bash
# Frontend (output: frontend/dist/)
cd frontend && npm run build

# Backend (output: backend/dist/)
cd backend && npm run build && node dist/index.js
```

---

## 16. Known Limitations & Tech Debt

### Bugs

1. **`search.ts` references non-existent `is_archived` column** — Full-text search queries may fail with a PostgreSQL error for queries that hit the archived-file exclusion logic. Should be `AND status != 'archived'`.

2. **Dashboard stats stale after bulk operations** — `bustDashboardCache()` is exported but not called in all routes that change file counts (e.g., bulk-action). Redis TTL (60s) is the fallback.

### Gaps

3. **No audit_log indexes** — On active deployments the audit table grows without indexes; admin queries will slow significantly. Recommend: `CREATE INDEX idx_audit_org_action ON audit_logs(organization_id, action, created_at DESC)`.

4. **No file encryption key rotation mechanism** — If the key is compromised, all files must be manually decrypted and re-encrypted.

5. **Knowledge article sanitisation dual approach** — Both a DOM-based allowlist sanitiser and old regex-based stripping exist. The DOM approach is robust; the regex code is dead weight.

6. **No idle session timeout** — Refresh tokens last 7 days regardless of activity. Consider implementing a sliding expiry.

7. **Bulk upload not rate-limited** — A single user could upload 20 × 50MB files in rapid succession (no per-user throttle beyond global 200/15min).

8. **PDF preview XSS risk** — PDFs are proxied directly; browser-level PDF JavaScript could be a concern on older clients.

9. **SMTP legacy code** — `mailer.ts` exists but is not connected to `emailService.ts`. The SMTP env vars in `.env.example` do nothing without wiring.

10. **`audit_logs.organization_id` nullable** — Platform-level events have null org; some admin queries that filter by org would miss platform events.

### Intentional Simplifications (not bugs)

- No Redis rate-limit counters — login failure counts are in `audit_logs` (acceptable for the scale)
- No CSRF tokens — relies entirely on `sameSite=strict` cookie behaviour
- No full-text index updates on file rename — FTS index uses expression index, PostgreSQL updates it automatically on UPDATE
- `file_comments` has no pagination — assumed reasonable volume per file
