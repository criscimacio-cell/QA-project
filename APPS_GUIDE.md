# Qlarity Apps — Branch & Run Guide

**Repository:** `https://github.com/criscimacio-cell/qa-project.git`

All 3 apps live in the **same repository**, on different branches and folders.

---

## App 1 — Qlarity App (Main QA Platform)

**Branch:** `claude/awesome-cray-nbes51` *(latest)* or `claude/loving-wright-KSSbB` *(blank — no demo data)*
**Stack:** React + TypeScript · Express.js + SQLite
**Folders:** `frontend/` + `backend/`

```bash
# Pull
git checkout claude/awesome-cray-nbes51
git pull origin claude/awesome-cray-nbes51

# Install (first time only)
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Run — open TWO terminals at the same time

# Terminal 1 — Backend
npx tsx backend/src/index.ts

# Terminal 2 — Frontend
cd frontend && npx vite
```

Open browser: `http://localhost:5173`

### Login Credentials

| Email | Role | Password |
|-------|------|----------|
| `admin@qa.com` | Admin | `password123` |
| `lead@qa.com` | QA Lead | `password123` |
| `engineer1@qa.com` | Engineer | `password123` |
| `viewer@qa.com` | Viewer | `password123` |

---

## App 2 — Qlarity Landing Page

**Branch:** `claude/awesome-cray-nbes51`
**Stack:** React + Vite + Tailwind CSS + Framer Motion
**Folder:** `landing/`

```bash
# Pull (same branch as App 1)
git checkout claude/awesome-cray-nbes51
git pull origin claude/awesome-cray-nbes51

# Install (first time only)
cd landing && npm install && cd ..

# Run
cd landing && npx vite
```

Open browser: `http://localhost:5174`
*(Vite will auto-pick the next available port if 5173 is already in use)*

---

## App 3 — XML Validator (PhilHealth KonSulTa)

**Branch:** `claude/ecstatic-carson-5cfvz1`
**Stack:** Python + Flask + Vue 3
**Folder:** `xml-validator-app/`

```bash
# Pull
git checkout claude/ecstatic-carson-5cfvz1
git pull origin claude/ecstatic-carson-5cfvz1

# Install (first time only — requires Python 3)
cd xml-validator-app
pip install flask flask-cors lxml openpyxl

# Run
python app.py
```

Open browser: `http://localhost:5000`

---

## Quick Summary

| App | Branch | Folder | Port | Stack |
|-----|--------|--------|------|-------|
| Qlarity App | `claude/awesome-cray-nbes51` | `frontend/` + `backend/` | 5173 + 3001 | React + Node.js |
| Landing Page | `claude/awesome-cray-nbes51` | `landing/` | 5174 | React + Vite |
| XML Validator | `claude/ecstatic-carson-5cfvz1` | `xml-validator-app/` | 5000 | Python + Flask |

---

## Switching Between Branches

```bash
# Save any uncommitted changes first (if needed)
git stash

# Switch to a branch
git checkout <branch-name>

# Always pull after switching
git pull origin <branch-name>
```

---

## Troubleshooting

**Port already in use:**
```bash
npx kill-port 3001   # kills backend
npx kill-port 5173   # kills frontend
npx kill-port 5000   # kills XML validator
```

**Missing Node modules:**
```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
cd landing && npm install && cd ..
```

**Missing Python packages:**
```bash
cd xml-validator-app
pip install flask flask-cors lxml openpyxl
```
