# Reverse Verification Tool - Project Architecture & Deployment Report

**Date:** January 18, 2026  
**Status:** Transitioning to Encore-based Full-Stack Deployment  
**Team:** Development Team

---

## Executive Summary

The **Reverse Verification Tool** is a full-stack application designed to verify device authenticity and ownership across marketplaces. After careful analysis and testing, we have determined the optimal deployment architecture:

- **Backend:** Encore.dev (TypeScript/Node.js)
- **Frontend:** React 19 + Vite (deployed with backend on Encore)
- **Database:** PostgreSQL (managed by Encore)
- **Hosting:** Encore Cloud (unified deployment)
- **Source Control:** GitHub (with automated workflows)
- **Related Project:** PayPass (separate Vercel deployment at paypass.website)

---

## What Changed & Why

### Previous Approach (Incorrect)
- ❌ Attempted to deploy frontend to GitHub Pages separately
- ❌ Tried to use Encore backend with static frontend hosting
- ❌ Created architectural mismatch between frontend and backend

### Root Cause
The project is built with **Encore's monorepo structure**, where:
- Frontend imports from backend using `~backend` alias
- This alias is resolved by Encore during build time
- Frontend cannot be built independently without backend code generation
- GitHub Pages (static-only) cannot support this architecture

### New Approach (Correct)
- ✅ Deploy entire app (backend + frontend) to Encore
- ✅ Encore handles code generation and linking automatically
- ✅ Frontend and backend share the same deployment
- ✅ GitHub Actions still tracks all changes and iterations
- ✅ Encore provides free tier suitable for this project

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                         │
│  (Source Code + GitHub Actions Workflows)                   │
│                                                              │
│  ├─ /backend (TypeScript, Encore services)                  │
│  ├─ /frontend (React 19, Vite)                              │
│  ├─ .github/workflows (CI/CD automation)                    │
│  └─ encore.app (Encore configuration)                       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ git push
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              GitHub Actions Workflows                        │
│  (Build verification, testing, artifact generation)         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Auto-trigger on push
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Encore Cloud                                │
│  (Full-stack deployment: Backend + Frontend)                │
│                                                              │
│  ├─ API Server (TypeScript/Node.js)                         │
│  ├─ PostgreSQL Database                                     │
│  ├─ Frontend Assets (React build)                           │
│  └─ Environment Variables & Secrets                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Live at:
                       ▼
        https://reverse-verification-tool-i452-staging.encr.app
        (Production: https://reverse-verification-tool-i452.encr.app)
```

---

## Key Components

### 1. Backend (Encore Services)
**Location:** `/backend/verification/`

| Service | Purpose |
|---------|---------|
| `verify.ts` | Core device verification logic |
| `device_fingerprinting.ts` | Device identification & fingerprinting |
| `trust_scoring.ts` | AI-powered trust score calculation |
| `badge_lifecycle.ts` | Verification badge management |
| `blockchain.ts` | Blockchain-backed verification records |
| `zkp_verification.ts` | Zero-knowledge proof verification |
| `marketplace_sdk.ts` | Marketplace integration SDK |
| `partner_api.ts` | Partner/seller API endpoints |

**Database:** PostgreSQL with Drizzle ORM  
**Caching:** Redis (via Upstash)

### 2. Frontend (React Application)
**Location:** `/frontend/`

| Component | Purpose |
|-----------|---------|
| `pages/VerificationPage.tsx` | Main device verification UI |
| `pages/LifecyclePage.tsx` | Badge lifecycle management |
| `pages/DashboardPage.tsx` | Analytics & usage dashboard |
| `components/` | Reusable UI components |
| `client.ts` | Auto-generated Encore API client |

**Build Tool:** Vite  
**UI Framework:** React 19 + shadcn/ui  
**Styling:** Tailwind CSS 4

### 3. Configuration Files
**Location:** Root directory

| File | Purpose |
|------|---------|
| `encore.app` | Encore application configuration |
| `.github/workflows/deploy-frontend.yml` | Build & deploy workflow |
| `.github/workflows/track-changes.yml` | Change tracking & reporting |
| `frontend/.env.development` | Local development environment |
| `frontend/.env.production` | Production environment (Encore) |

---

## Deployment Flow

### Step 1: Code Push
```bash
git push origin main
```

### Step 2: GitHub Actions Triggers
- Workflow: `deploy-frontend.yml`
- Actions:
  - Checkout code
  - Install dependencies (bun)
  - Build frontend (Vite)
  - Build backend (Encore)
  - Run tests
  - Generate artifacts

### Step 3: Encore Auto-Deploy
- Encore detects changes via GitHub webhook
- Automatically triggers build process
- Generates `encore.gen/` directory (client code)
- Compiles backend services
- Deploys to staging environment
- Runs database migrations if needed

### Step 4: Live Deployment
- Frontend served from Encore
- Backend API available at same domain
- All environment variables injected automatically
- Database connections established

---

## Environment Variables

### Development (Local)
**File:** `frontend/.env.development`
```
VITE_CLIENT_TARGET=http://localhost:4000
```

**Run locally:**
```bash
cd backend
encore run
```

### Production (Encore)
**File:** `frontend/.env.production`
```
VITE_CLIENT_TARGET=http://localhost:4000
```
(Encore automatically resolves to the correct backend URL during deployment)

### Secrets Management
Sensitive variables are stored in Encore dashboard:
- Database credentials
- API keys
- JWT secrets
- Third-party API tokens

**Access:** https://app.encore.cloud/reverse-verification-tool-i452/settings/secrets

---

## GitHub Actions Workflows

### 1. Deploy Frontend (`deploy-frontend.yml`)
**Triggers:** Push to main/master, manual trigger  
**Steps:**
- Build frontend with Vite
- Generate artifacts
- Deploy to Encore (via webhook)

**View:** https://github.com/kudzimusar/reverse-verification-tool/actions/workflows/deploy-frontend.yml

### 2. Track Changes (`track-changes.yml`)
**Triggers:** Every push  
**Steps:**
- Analyze code changes
- Generate iteration report
- Comment on PRs with statistics
- Track bundle size

**View:** https://github.com/kudzimusar/reverse-verification-tool/actions/workflows/track-changes.yml

---

## Deployment URLs

| Environment | URL | Purpose |
|-------------|-----|---------|
| **Staging** | https://reverse-verification-tool-i452-staging.encr.app | Testing & QA |
| **Production** | https://reverse-verification-tool-i452.encr.app | Live users |
| **Dashboard** | https://app.encore.cloud/reverse-verification-tool-i452 | Management |
| **GitHub Repo** | https://github.com/kudzimusar/reverse-verification-tool | Source code |
| **Related Project** | https://paypass.website | Separate Vercel app |

---

## Related Projects

### PayPass (Separate Project)
- **Deployment:** Vercel
- **URL:** https://paypass.website
- **Status:** Independent, no conflicts
- **Integration:** None with reverse-verification-tool

**Important:** PayPass continues to work independently. The reverse-verification-tool is a separate application.

---

## Common Tasks

### Deploy Changes
```bash
git push origin main
# Automatically triggers GitHub Actions and Encore deployment
```

### View Deployment Status
1. GitHub Actions: https://github.com/kudzimusar/reverse-verification-tool/actions
2. Encore Dashboard: https://app.encore.cloud/reverse-verification-tool-i452

### Run Locally
```bash
# Install dependencies
cd backend && bun install
cd ../frontend && bun install

# Start backend
cd backend
encore run

# In another terminal, start frontend
cd frontend
bun run dev
```

### View Logs
- **GitHub Actions:** Actions tab → Workflow run → View logs
- **Encore:** Dashboard → Deployments → View logs

### Access Database
- **Encore Dashboard:** Settings → Database
- **Connection String:** Provided in Encore dashboard

---

## Troubleshooting

### Build Fails in GitHub Actions
1. Check GitHub Actions logs: https://github.com/kudzimusar/reverse-verification-tool/actions
2. Common issues:
   - Missing dependencies: Run `bun install` locally first
   - TypeScript errors: Run `bun run check` locally
   - Environment variables: Check Encore secrets

### Frontend Not Loading
1. Check browser console for errors
2. Verify backend is running: `encore run`
3. Check `VITE_CLIENT_TARGET` in `.env.production`
4. Verify Encore deployment succeeded

### Database Connection Issues
1. Check PostgreSQL is running
2. Verify connection string in Encore secrets
3. Run migrations: `bun run db:migrate`

---

## Team Responsibilities

| Role | Responsibility |
|------|-----------------|
| **Backend Developer** | Modify `/backend/verification/` services |
| **Frontend Developer** | Modify `/frontend/` components and pages |
| **DevOps** | Manage Encore secrets and deployments |
| **QA** | Test on staging: https://reverse-verification-tool-i452-staging.encr.app |

---

## Important Notes

1. **Never commit secrets** to GitHub - use Encore secrets management
2. **Always test locally** before pushing to main
3. **Check GitHub Actions** after every push to verify deployment
4. **Monitor Encore dashboard** for deployment status
5. **Keep encore.app** in sync with Encore configuration
6. **Document changes** in commit messages for team clarity

---

## Next Steps

1. ✅ Encore app created and configured
2. ⏳ First deployment to staging (in progress)
3. ⏳ Verify full UI works with backend
4. ⏳ Configure production environment
5. ⏳ Team training and knowledge sharing

---

**Questions?** Refer to this document or check the KNOWLEDGE_RULES.md file for specific guidelines.
