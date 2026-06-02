# Q-KTAMP — How to Run (Step-by-Step Guide)

> **QA Knowledge & Test Asset Management Platform**  
> Built with React 18 + TypeScript (Frontend) · Express.js + SQLite (Backend)

---

## Prerequisites

Make sure the following are installed on your machine before you begin.

| Tool | Version | Check Command |
|------|---------|---------------|
| Node.js | v18 or higher | `node --version` |
| npm | v8 or higher | `npm --version` |
| Git | Any recent version | `git --version` |

---

### How to Install Git on Windows

> **If you see:** `'git' is not recognized as the name of a cmdlet...`  
> Git is not installed. Follow these steps:

**Option A — Git for Windows (Recommended)**

1. Go to: **https://git-scm.com/download/win**
2. Click the download link — it starts automatically
3. Run the installer (`.exe` file)
4. On every screen, click **Next** — the defaults are fine
5. On the screen **"Adjusting your PATH environment"**, select:  
   ✅ **Git from the command line and also from 3rd-party software**
6. Continue clicking **Next** → **Install** → **Finish**
7. **Close and reopen PowerShell or Command Prompt**
8. Verify it works:
   ```powershell
   git --version
   # Should show: git version 2.x.x.windows.x
   ```

**Option B — GitHub Desktop (Easiest, includes Git)**

1. Go to: **https://desktop.github.com**
2. Download and install GitHub Desktop
3. Git is included automatically
4. Open **Git Bash** from the Start Menu to run git commands

---

### How to Install Node.js on Windows

> **If you see:** `'node' is not recognized...`

1. Go to: **https://nodejs.org**
2. Click **"LTS"** (the green button — recommended for most users)
3. Run the downloaded `.msi` installer
4. Click **Next** on every screen → **Install** → **Finish**
5. **Close and reopen PowerShell**
6. Verify:
   ```powershell
   node --version   # Should show v18.x.x or higher
   npm --version    # Should show v8.x.x or higher
   ```

---

> **Download Node.js**: https://nodejs.org (choose LTS version)

---

## Step 1 — Clone the Repository

Open your terminal (Command Prompt, PowerShell, or macOS/Linux Terminal).

```bash
git clone https://github.com/criscimacio-cell/qa-project.git
```

Then enter the project folder:

```bash
cd qa-project
```

---

## Step 2 — Switch to the Application Branch

The application lives on the feature branch. Switch to it:

```bash
git checkout claude/loving-wright-KSSbB
```

Verify you are on the correct branch:

```bash
git branch
# Should show: * claude/loving-wright-KSSbB
```

---

## Step 3 — Install All Dependencies

Run this single command from the **root** of the project. It installs dependencies for the root, backend, and frontend all at once:

```bash
npm install && npm install --workspace=backend && npm install --workspace=frontend
```

> This may take 1–2 minutes. You will see npm progress messages — this is normal.

---

## Step 4 — Start the Backend Server

Open a **new terminal window** (keep this one open the whole time).

Navigate to the project folder and run:

```bash
npx tsx backend/src/index.ts
```

You should see these two lines, confirming the backend is running:

```
Database initialized and seeded successfully
Q-KTAMP API running on http://localhost:3001
```

> The database (`data/qtamp.db`) is created automatically on first run with all demo data pre-loaded.

**Leave this terminal open.** Do not close it.

---

## Step 5 — Start the Frontend Dev Server

Open a **second terminal window**.

Navigate to the frontend folder:

```bash
cd frontend
```

Start the frontend:

```bash
npx vite
```

You should see output like:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

**Leave this terminal open too.**

---

## Step 6 — Open the Application

Open your web browser and go to:

```
http://localhost:5173
```

You will see the **Q-KTAMP Login Page**.

---

## Step 7 — Log In with Demo Credentials

Click any of the demo credential buttons on the login page, or type them manually.  
**All accounts use the same password:** `password123`

| Email | Role | Access Level |
|-------|------|--------------|
| `admin@qa.com` | QA Admin | Full access — user management, audit logs, all settings |
| `lead@qa.com` | QA Lead | Repository management, approvals, analytics |
| `engineer1@qa.com` | QA Engineer | Upload files, manage own assets |
| `viewer@qa.com` | Viewer | View and download only |

> **Tip:** Start with `admin@qa.com` to explore all features.

---

## Step 8 — Explore the Platform

Once logged in, use the **left sidebar** to navigate:

### Main
| Page | What You Can Do |
|------|----------------|
| **Dashboard** | View stats, charts, upload trends, recent activity |
| **Repositories** | Browse the folder tree, view/upload files per folder |
| **File Manager** | Search/filter all files, approve/reject, view versions |
| **Search** | Full-text search across files, articles, Jira tickets |

### Content
| Page | What You Can Do |
|------|----------------|
| **Knowledge Base** | Read/write team guides, RCA docs, best practices |
| **Test Data Library** | Browse published test assets and templates |
| **Approval Workflow** | Kanban board — move files through review pipeline |

### Admin *(Admin and Lead roles only)*
| Page | What You Can Do |
|------|----------------|
| **User Management** | Add/edit users, assign roles, view permission matrix |
| **Audit Log** | View all system events, export CSV |
| **Settings** | Change password, view platform info |

---

## Stopping the Application

To stop, go to each terminal and press:

```
Ctrl + C
```

Do this in both the **backend terminal** and the **frontend terminal**.

---

## Restarting After a Stop

You do **not** need to reinstall dependencies. Just repeat **Steps 4 and 5**:

```bash
# Terminal 1 — Backend
npx tsx backend/src/index.ts

# Terminal 2 — Frontend
cd frontend && npx vite
```

---

## Troubleshooting

### Port already in use

If you see `EADDRINUSE: address already in use`, another process is using port 3001 or 5173.

**On macOS/Linux:**
```bash
# Kill whatever is using port 3001
lsof -ti:3001 | xargs kill -9

# Kill whatever is using port 5173
lsof -ti:5173 | xargs kill -9
```

**On Windows (PowerShell):**
```powershell
# Find and kill port 3001
netstat -ano | findstr :3001
taskkill /PID <PID_NUMBER> /F
```

---

### Cannot find module error

If you see a module not found error, reinstall dependencies:

```bash
npm install && npm install --workspace=backend && npm install --workspace=frontend
```

---

### Database issues / want a fresh start

Delete the auto-generated database file and restart the backend. It will recreate and re-seed everything:

```bash
rm -rf data/
npx tsx backend/src/index.ts
```

---

### Login fails with "Invalid credentials"

Make sure you are using the exact email and password below:

- Email: `admin@qa.com`
- Password: `password123`

Passwords are case-sensitive. There are no spaces.

---

## Project Structure (Quick Reference)

```
qa-project/
│
├── backend/                  ← Express.js API server
│   └── src/
│       ├── index.ts          ← Entry point (starts on port 3001)
│       ├── db.ts             ← SQLite setup + seed data
│       ├── middleware/
│       │   └── auth.ts       ← JWT authentication
│       └── routes/
│           ├── auth.ts       ← Login, logout, change password
│           ├── users.ts      ← User CRUD
│           ├── repositories.ts ← Folder/repo management
│           ├── files.ts      ← File upload, download, approval
│           ├── knowledge.ts  ← Knowledge base articles
│           ├── search.ts     ← Full-text search
│           ├── dashboard.ts  ← Stats and charts data
│           ├── notifications.ts ← In-app notifications
│           └── audit.ts      ← Audit log
│
├── frontend/                 ← React + Vite app
│   └── src/
│       ├── App.tsx           ← Routes
│       ├── pages/            ← One file per page/screen
│       ├── components/       ← Reusable UI components
│       ├── context/          ← Auth + Theme state
│       └── api/client.ts     ← Axios instance with JWT
│
├── data/                     ← Auto-created SQLite database
├── uploads/                  ← Auto-created file upload storage
└── package.json              ← Root workspace config
```

---

## API Endpoints (Reference)

The backend runs on `http://localhost:3001`. All endpoints require a Bearer token except `/api/auth/login`.

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login — returns JWT token |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/dashboard/stats` | Dashboard metrics |
| GET | `/api/repositories` | All folders/repos |
| GET | `/api/files` | List files (supports filters) |
| POST | `/api/files/upload` | Upload a file with metadata |
| GET | `/api/search?q=` | Full-text search |
| GET | `/api/knowledge` | Knowledge articles |
| GET | `/api/notifications` | User notifications |
| GET | `/api/audit` | Audit log (admin/lead only) |
| GET | `/api/users` | User list |

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Styling | Tailwind CSS (primary color: `#08a49c`) |
| Charts | Recharts |
| Icons | Lucide React |
| HTTP Client | Axios |
| Routing | React Router v6 |
| Backend Framework | Express.js + TypeScript |
| Database | SQLite via better-sqlite3 |
| Authentication | JWT (8-hour sessions) + bcrypt |
| Runtime | Node.js v18+ |

---

*Q-KTAMP v1.0.0 — Enterprise QA Asset Management Platform*
