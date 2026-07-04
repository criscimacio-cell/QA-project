# Qlarity DMS — How to Run

> Multi-tenant QA document management platform.
> React 18 + TypeScript (frontend) · Express.js + PostgreSQL + Redis (backend)

---

## Prerequisites

- **Node.js 20+** — https://nodejs.org
- **PostgreSQL 16** — running locally, or via Docker (see below)
- **Redis 6.2+** — running locally, or via Docker (see below)
- **Git**

Verify versions:

```bash
node --version   # v20.x or newer
npm --version
```

---

## Option A — Local Development (backend + frontend on the host)

### 1. Clone and install

```bash
git clone https://github.com/criscimacio-cell/qa-project.git
cd qa-project
npm run install:all
```

This installs the root, `backend/`, and `frontend/` workspaces.

### 2. Start PostgreSQL and Redis

If you don't already have them running locally, the quickest path is to start just the data services from Docker Compose and run the app itself on the host:

```bash
docker compose up -d postgres redis
```

(Or install/run Postgres 16 and Redis locally by any other means — the app just needs a reachable `DATABASE_URL` and `REDIS_URL`.)

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

```bash
DATABASE_URL=postgresql://qtamp:qtamp_dev@localhost:5432/qtamp
REDIS_URL=redis://localhost:6379
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
```

Everything else in `.env.example` has a working default for local development (encryption, email, etc. — see the comments in that file for what each variable does).

### 4. Run

```bash
npm run dev
```

This runs the backend and frontend concurrently. On first boot the backend creates the database schema and seeds demo data automatically (seeding is skipped when `NODE_ENV=production`).

- Backend: http://localhost:3001
- Frontend: http://localhost:5173

Open http://localhost:5173 in your browser.

### 5. Log in

All demo accounts use password **`password123`**:

| Email | Role | What They Can Do |
|-------|------|-------------------|
| `admin@qa.com` | Admin | Everything — users, audit logs, org settings |
| `lead@qa.com` | Lead | Approve files, manage repositories |
| `engineer1@qa.com` | Engineer | Upload and manage files |
| `engineer2@qa.com` | Engineer | Upload and manage files |
| `viewer@qa.com` | Viewer | View and download only |

> Start with `admin@qa.com` to see all features.

The platform-admin (backoffice, cross-tenant) account is **not** seeded with a fixed password — on first boot the backend generates one and prints it once to the console. Save it, or set `PLATFORM_ADMIN_PASSWORD` in `.env` to pin your own.

### Stopping / restarting

Press `Ctrl+C` to stop `npm run dev`. To restart later (dependencies already installed):

```bash
npm run dev
```

---

## Option B — Full Docker Compose (production-like)

Runs Postgres, Redis, backend, and frontend/nginx all in containers:

```bash
cp .env.example .env
# Edit .env: set JWT_SECRET, POSTGRES_PASSWORD, FILE_ENCRYPTION_KEY at minimum
docker compose up -d --build
```

- App: http://localhost (nginx proxies `/api` and `/ws` to the backend, serves the built frontend)
- Postgres/Redis are **not** published to the host in this setup — they're only reachable from other containers on the compose network.

Stop with `docker compose down` (add `-v` to also remove the database/upload volumes).

---

## Error Tracking (GlitchTip) — one-time setup

`docker compose up` also starts a self-hosted, Sentry-API-compatible error
tracker (GlitchTip) alongside the app, with its own dedicated Postgres/Redis
so it can't compete with the app's cache for memory. It ships with no
connection to the backend until you complete this **one-time, manual**
setup — the piece that can't be pre-baked into `.env.example` is the DSN,
which GlitchTip only assigns after you create a project through its UI.

1. Set `GLITCHTIP_SECRET_KEY` in `.env` before first boot (generate with
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   — this is required for GlitchTip's containers to start correctly.
2. `docker compose up -d` (or `--build` if this is the first run).
3. Open `http://localhost:8000` (or whatever `GLITCHTIP_DOMAIN`/`GLITCHTIP_PORT`
   you configured) and create your account — the first user to sign up
   becomes the organization owner.
4. In the GlitchTip UI, create a new project (choose "Node.js" as the
   platform). It will show you a DSN that looks like
   `http://<key>@localhost:8000/<project-id>`.
5. Set `GLITCHTIP_DSN` in `.env` to that value, then
   `docker compose up -d backend` to restart just the backend and pick it up.
6. Trigger a real error (e.g., a bad request that 500s) and confirm it shows
   up in GlitchTip's issue list within a few seconds.

Until step 5 is done, the backend runs completely normally — an unset
`GLITCHTIP_DSN` just means errors aren't forwarded anywhere beyond the
existing structured logs.

---

## Troubleshooting

### "Cannot find module 'express'" or similar
Dependencies weren't installed. Run `npm run install:all` from the repo root.

### "ECONNREFUSED" connecting to Postgres or Redis
Make sure `docker compose up -d postgres redis` (or your local equivalent) is running, and that `DATABASE_URL`/`REDIS_URL` in `.env` point to the right host/port.

### "FATAL: JWT_SECRET environment variable is not set"
Set `JWT_SECRET` in `.env` — the backend refuses to start without it.

### "EADDRINUSE" (port already in use)
Something else is using port 3001 or 5173:

```bash
npx kill-port 3001
npx kill-port 5173
```

### Login fails with demo credentials
Use exactly `admin@qa.com` / `password123` (case-sensitive, no spaces). Demo accounts are only seeded when `NODE_ENV` is not `production` — if you're pointed at a production database, they won't exist.

---

## Project Structure

```
qa-project/
├── backend/
│   └── src/
│       ├── index.ts            # Express app entry point
│       ├── db.ts                # PostgreSQL client
│       ├── redis.ts             # Redis client (caching, pub/sub, rate limits)
│       ├── initDb.ts            # Schema creation + seed data
│       ├── middleware/auth.ts   # JWT authentication
│       └── routes/              # API endpoints
├── frontend/
│   └── src/
│       ├── App.tsx              # Routes
│       ├── pages/                # Dashboard, Repositories, Files, etc.
│       ├── components/           # Sidebar, TopBar, UI components
│       ├── context/               # Auth + Theme
│       └── api/client.ts         # Axios client
├── uploads/                      # Encrypted file storage (auto-created)
├── docker-compose.yml            # Postgres, Redis, backend, frontend/nginx
└── nginx.conf                    # Reverse proxy config used by docker-compose
```

See `ARCHITECTURE.md` for the full technical reference (API endpoints, database schema, security model, deployment checklist).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Backend | Express.js + TypeScript |
| Database | PostgreSQL 16 |
| Cache / Queue | Redis + BullMQ |
| Auth | JWT + bcrypt |
| Runtime | Node.js 20+ |
