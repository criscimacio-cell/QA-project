# Q-KTAMP — How to Run (Step-by-Step Guide)

> **QA Knowledge & Test Asset Management Platform**
> React 18 + TypeScript (Frontend) · Express.js + SQLite (Backend)

---

## Part 1 — Install Required Tools (Do This Once)

### Step 1 — Install Git

1. Open your browser and go to: **https://git-scm.com/download/win**
2. Click **"Git for Windows/x64 Setup"** — the download starts automatically
3. Run the downloaded `.exe` file
4. Click through the installer — **do not change any defaults**
5. On the **"Adjusting your PATH environment"** screen, select:
   ✅ **"Git from the command line and also from 3rd-party software"**
6. Keep clicking **Next** → **Install**
7. On the last screen: ✅ check **"Launch Git Bash"** → click **Finish**

> Git Bash will open automatically. Use **Git Bash** for ALL commands in this guide.

---

### Step 2 — Install Node.js

1. Open your browser and go to: **https://nodejs.org**
2. Click the **LTS** button (the green one)
3. Run the downloaded `.msi` installer
4. Click **Next** through all screens → **Install** → **Finish**
5. **Close and reopen Git Bash**
6. Verify it works:
   ```bash
   node --version
   # Should show: v18.x.x or v22.x.x
   npm --version
   # Should show: v8.x.x or higher
   ```

---

## Part 2 — Get the Project

### Step 3 — Clone the Repository

In Git Bash, run:

```bash
git clone https://github.com/criscimacio-cell/qa-project.git
```

### Step 4 — Enter the Project Folder

```bash
cd qa-project
```

### Step 5 — Switch to the App Branch

```bash
git checkout claude/loving-wright-KSSbB
```

---

## Part 3 — Install Project Dependencies

> ⚠️ **Important:** You must install dependencies in BOTH the backend and frontend folders separately. Do not skip this.

### Step 6 — Install Backend Dependencies

```bash
cd backend
npm install
cd ..
```

Wait for it to finish completely before moving on.

### Step 7 — Install Frontend Dependencies

```bash
cd frontend
npm install
cd ..
```

Wait for it to finish completely before moving on.

---

## Part 4 — Run the Application

> You need **two Git Bash windows open at the same time** — one for the backend, one for the frontend.

### Step 8 — Start the Backend (Window 1)

In your current Git Bash window, make sure you are in the `qa-project` folder:

```bash
cd ~/Desktop/qa-project
```

Then start the backend:

```bash
npx tsx backend/src/index.ts
```

You should see:

```
Database initialized and seeded successfully
Q-KTAMP API running on http://localhost:3001
```

**Leave this window open. Do not close it.**

---

### Step 9 — Open a Second Git Bash Window

Right-click on your Desktop → **Git Bash Here**

OR open Git Bash from the Start Menu again.

---

### Step 10 — Start the Frontend (Window 2)

In the second Git Bash window:

```bash
cd ~/Desktop/qa-project/frontend
npx vite
```

You should see:

```
  VITE v5.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
```

**Leave this window open too.**

---

### Step 11 — Open the App in Your Browser

Go to:

```
http://localhost:5173
```

---

## Part 5 — Log In

Click any demo user button on the login page, or type the credentials manually.
**All accounts use password:** `password123`

| Email | Role | What They Can Do |
|-------|------|-----------------|
| `admin@qa.com` | QA Admin | Everything — users, audit logs, all settings |
| `lead@qa.com` | QA Lead | Approve files, manage repos, view analytics |
| `engineer1@qa.com` | QA Engineer | Upload and manage files |
| `viewer@qa.com` | Viewer | View and download only |

> **Start with `admin@qa.com` to see all features.**

---

## Stopping the App

Press **Ctrl + C** in both Git Bash windows.

---

## Restarting the App (Next Time)

Dependencies are already installed — just repeat Steps 8–10:

```bash
# Window 1 — Backend
cd ~/Desktop/qa-project
npx tsx backend/src/index.ts

# Window 2 — Frontend
cd ~/Desktop/qa-project/frontend
npx vite
```

---

## Troubleshooting

### "git is not recognized"
Git is not installed or Git Bash is not open. Follow Step 1 above.
Use **Git Bash** — not PowerShell, not Command Prompt.

---

### "Cannot find module 'express'" or "Cannot find module 'better-sqlite3'"
Backend dependencies are not installed. Run:
```bash
cd ~/Desktop/qa-project/backend
npm install
cd ..
```

---

### "Cannot find package 'vite'" or vite config errors
Frontend dependencies are not installed. Run:
```bash
cd ~/Desktop/qa-project/frontend
npm install
```
Then run `npx vite` again.

---

### "EADDRINUSE: address already in use" (port already taken)
Something else is using port 3001 or 5173. Run in Git Bash:
```bash
# Kill port 3001
npx kill-port 3001

# Kill port 5173
npx kill-port 5173
```

---

### "gyp ERR! find VS" / "No prebuilt binaries found"
This happens when using an old version of the project. Make sure you have the latest code:
```bash
cd ~/Desktop/qa-project
git pull
cd backend
npm install
```
The current version uses `better-sqlite3 v11` which has prebuilt binaries for Node.js 22 and does **not** require Visual Studio.

---

### Login fails
Use exactly:
- Email: `admin@qa.com`
- Password: `password123`

Passwords are case-sensitive. No spaces.

---

## Quick Reference — All Commands

```bash
# 1. Clone (first time only)
git clone https://github.com/criscimacio-cell/qa-project.git
cd qa-project
git checkout claude/loving-wright-KSSbB

# 2. Install (first time only)
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 3. Run — Window 1 (Backend)
cd ~/Desktop/qa-project
npx tsx backend/src/index.ts

# 4. Run — Window 2 (Frontend)
cd ~/Desktop/qa-project/frontend
npx vite

# 5. Open browser
# http://localhost:5173
```

---

## Project Structure

```
qa-project/
├── backend/                  ← Express.js API (port 3001)
│   └── src/
│       ├── index.ts          ← Server entry point
│       ├── db.ts             ← SQLite database + seed data
│       ├── middleware/auth.ts ← JWT authentication
│       └── routes/           ← API endpoints
│           ├── auth.ts
│           ├── users.ts
│           ├── repositories.ts
│           ├── files.ts
│           ├── knowledge.ts
│           ├── search.ts
│           ├── dashboard.ts
│           ├── notifications.ts
│           └── audit.ts
│
├── frontend/                 ← React app (port 5173)
│   └── src/
│       ├── App.tsx           ← Routes
│       ├── pages/            ← Dashboard, Repositories, Files, etc.
│       ├── components/       ← Sidebar, TopBar, UI components
│       ├── context/          ← Auth + Theme
│       └── api/client.ts     ← Axios + JWT
│
├── data/                     ← Auto-created SQLite database
└── uploads/                  ← Auto-created file storage
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS · Primary color: `#08a49c` |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Express.js + TypeScript |
| Database | SQLite (better-sqlite3 v11) |
| Auth | JWT + bcrypt |
| Runtime | Node.js v18+ or v22+ |

---

*Q-KTAMP v1.0.0 — Enterprise QA Asset Management Platform*
