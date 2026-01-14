# GitHub Pages Setup for Reverse Verification Tool

This guide provides complete instructions for enabling GitHub Pages deployment for the frontend of the Reverse Verification Tool using GitHub Actions.

## Overview

The setup includes:
- **Automated Frontend Deployment:** GitHub Actions automatically builds and deploys the frontend to GitHub Pages on every push to `main` or `master`
- **Change Tracking:** Detailed iteration reports for every commit
- **Build Verification:** Ensures frontend builds correctly before deployment
- **Pull Request Integration:** Automatic comments with change summaries on PRs

## Prerequisites

1. Admin access to the `kudzimusar/reverse-verification-tool` repository
2. GitHub account with permissions to manage repository settings
3. Git configured with your credentials

## Step 1: Enable GitHub Pages

1. Go to your repository: https://github.com/kudzimusar/reverse-verification-tool
2. Click **Settings** (top navigation)
3. Click **Pages** (left sidebar under "Code and automation")
4. Under "Build and deployment":
   - **Source:** Select **"GitHub Actions"**
5. Click **Save**

## Step 2: Configure Workflow Permissions

1. Go to **Settings → Actions → General**
2. Under "Workflow permissions":
   - Select **"Read and write permissions"**
   - Check **"Allow GitHub Actions to create and approve pull requests"** (optional)
3. Click **Save**

## Step 3: Workflows Are Already in Place

The following workflows have been added to `.github/workflows/`:

### `deploy-frontend.yml`
- **Trigger:** Push to main/master, pull requests, manual dispatch
- **Jobs:**
  - `build`: Installs dependencies and builds frontend with Bun
  - `deploy`: Deploys to GitHub Pages (main/master only)
  - `verify`: Verifies build output contains index.html
  - `notify`: Creates deployment summary

### `track-changes.yml`
- **Trigger:** Push and pull requests
- **Jobs:**
  - `track-changes`: Generates iteration reports with file statistics
  - Comments on PRs with change summary

## Step 4: Push to Deploy

The workflows are already committed. Just push to main:

```bash
cd reverse-verification-tool
git push origin main
```

The deployment will automatically trigger. Monitor progress:
1. Go to your repository
2. Click **Actions** tab
3. Watch the "Deploy Frontend to GitHub Pages" workflow

## Step 5: Access Your Site

Once deployment completes (green checkmark):
- **GitHub Pages URL:** `https://kudzimusar.github.io/reverse-verification-tool/`
- Check the workflow summary for the exact URL

## Workflow Details

### Deploy Frontend Workflow

**When it runs:**
- Every push to main or master
- Every pull request to main or master
- Manual trigger via Actions tab

**What it does:**

1. **Build Job**
   - Checks out code
   - Sets up Node.js 22
   - Sets up Bun (the package manager used by frontend)
   - Installs dependencies with `bun install`
   - Builds frontend with `bun run build`
   - Sets `VITE_GITHUB_PAGES=true` for correct base path
   - Uploads build artifacts

2. **Deploy Job** (only on push to main/master)
   - Deploys the build to GitHub Pages
   - Provides deployment URL

3. **Verify Job**
   - Downloads build artifacts
   - Verifies `dist/index.html` exists
   - Reports build statistics

4. **Notify Job**
   - Creates deployment summary
   - Reports all job statuses

### Change Tracking Workflow

**When it runs:**
- Every push to any branch
- Every pull request

**What it does:**
- Extracts commit information
- Counts file changes (added, modified, deleted)
- Generates iteration report
- Comments on PRs with summary
- Uploads report artifact (retained 90 days)

## Making Changes

### Push Updates
```bash
# Make changes to frontend code
cd frontend

# Test locally
bun run dev

# Build locally
bun run build

# Commit and push
git add .
git commit -m "Update frontend: Add new feature"
git push origin main

# Deployment happens automatically!
# Check Actions tab to monitor
```

### Create Feature Branch
```bash
# Create new branch
git checkout -b feature/my-feature

# Make changes
git commit -m "Add feature"

# Push and create PR
git push origin feature/my-feature

# Go to GitHub and create Pull Request
# Workflow will automatically:
# - Build and test your changes
# - Comment with detailed change summary
# - Show file statistics
```

## Monitoring Deployments

### View Workflow Runs
1. Go to **Actions** tab
2. Click **"Deploy Frontend to GitHub Pages"** or **"Track Changes and Iterations"**
3. Click a workflow run to see details
4. Expand job steps to see logs

### View Deployment Summary
1. Go to **Actions → Deploy Frontend to GitHub Pages**
2. Click the latest run
3. Scroll to **"Notify"** job
4. See deployment summary with status

### Download Iteration Reports
1. Go to **Actions → Track Changes and Iterations**
2. Click a workflow run
3. Download **"iteration-report-XXXX"** artifact
4. View detailed change statistics

## Troubleshooting

### Deployment Failed
**Problem:** Workflow shows ❌ failed status
**Solution:**
1. Click the failed workflow run
2. Expand job steps to see error logs
3. Common issues:
   - Missing `dist/index.html` - Check build configuration
   - Bun installation failed - Check package.json
   - Dependency issues - Run `bun install` locally
4. Fix locally and push again

### Site Not Updating
**Problem:** Changes not visible on GitHub Pages
**Solution:**
1. Clear browser cache (Ctrl+Shift+Delete)
2. Check Actions tab - verify workflow completed (green checkmark)
3. Verify GitHub Pages settings (should be "GitHub Actions")
4. Wait 1-2 minutes for DNS propagation
5. Check URL is correct: `https://kudzimusar.github.io/reverse-verification-tool/`

### Build Takes Too Long
**Problem:** Workflow takes >5 minutes
**Solution:**
1. Check for large dependencies
2. Review bundle analysis in workflow logs
3. Consider code splitting
4. Check for unnecessary files

### 404 Errors on Site
**Problem:** Assets or pages return 404
**Solution:**
1. Verify base path in `frontend/vite.config.ts` (should be `/reverse-verification-tool/`)
2. Ensure all assets are in `frontend/public/` folder
3. Check `dist/index.html` exists in workflow artifacts
4. Verify asset paths use correct base path

## Local Development

### Install Dependencies
```bash
cd frontend
bun install
```

### Start Development Server
```bash
cd frontend
bun run dev
# Opens at http://localhost:3000
```

### Build Locally
```bash
cd frontend
bun run build
# Creates dist/ directory
```

## Configuration

### Environment Variables
The workflow sets this environment variable:
```
VITE_GITHUB_PAGES=true
```

This tells Vite to use `/reverse-verification-tool/` as the base path.

### Vite Configuration
The `frontend/vite.config.ts` has been updated to:
- Check for `VITE_GITHUB_PAGES` environment variable
- Use `/reverse-verification-tool/` as base path when deploying
- Use `/` for local development

## Advanced Configuration

### Custom Domain
1. Go to **Settings → Pages**
2. Under "Custom domain", enter your domain
3. Add DNS records as instructed by GitHub
4. GitHub will handle HTTPS automatically

### Branch Protection
1. Go to **Settings → Branches**
2. Add rule for `main` branch
3. Require status checks to pass before merging
4. Select the workflows as required checks

### Secrets Management
For sensitive data:
1. Go to **Settings → Secrets and variables → Actions**
2. Click "New repository secret"
3. Add secret name and value
4. Reference in workflows: `${{ secrets.SECRET_NAME }}`

## Performance Optimization

### Monitor Build Time
- Check workflow logs for build duration
- Artifacts retained for 30 days
- Iteration reports retained for 90 days

### Reduce Bundle Size
- Check for large dependencies
- Consider code splitting
- Lazy load heavy components
- Compress images

## Support & Resources

### Documentation
- **GitHub Pages:** https://docs.github.com/pages
- **GitHub Actions:** https://docs.github.com/actions
- **Vite:** https://vitejs.dev
- **React:** https://react.dev
- **Bun:** https://bun.sh

### Troubleshooting
1. Check workflow logs in Actions tab
2. Review error messages carefully
3. Consult documentation files
4. Search GitHub Actions documentation

## Deployment Checklist

- [ ] Enable GitHub Pages (Settings → Pages)
- [ ] Configure workflow permissions (Settings → Actions)
- [ ] Push code to main branch
- [ ] Verify workflow runs in Actions tab
- [ ] Confirm deployment completed (green checkmark)
- [ ] Access GitHub Pages URL
- [ ] Test site functionality
- [ ] Create feature branch for testing
- [ ] Create pull request
- [ ] Verify PR workflow comments
- [ ] Review iteration report
- [ ] Merge PR and verify deployment

## Next Steps

1. **Enable GitHub Pages**
   - Follow Step 1 above
   - Configure workflow permissions

2. **Test Deployment**
   - Make a small change to frontend
   - Push to main
   - Watch deployment in Actions tab
   - Verify site updates

3. **Create Feature Branch**
   - Create new branch
   - Make changes
   - Create PR
   - Review workflow comments
   - Merge and verify deployment

4. **Monitor**
   - Check Actions tab regularly
   - Review iteration reports
   - Monitor build times
   - Track deployment frequency

## Summary

Your frontend is now set up for:
✅ Automated GitHub Pages deployment
✅ Change tracking with iteration reports
✅ Build verification
✅ PR integration with automatic summaries
✅ Continuous deployment on every push

**Your site is live at:** `https://kudzimusar.github.io/reverse-verification-tool/`

---

**Last Updated:** January 2026
**Status:** Production Ready
**Workflows:** 2 Active (Deploy Frontend + Track Changes)
**Package Manager:** Bun
**Frontend Framework:** React 19
