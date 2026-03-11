# 🚀 DevOps Agent Task Specification: Seat Swap V1

> **Role**: CI/CD Pipelines, Infrastructure, Deployment Validation
> **Context**: You are working on the Seat Swap V1 DevOps workstream.
> **Key Objective**: Ensure frictionless, automated testing on every PR, automated APK generation, and validation of the Render backend deployment.

---

## ⚙️ Ticket: RM-SW-050 — Configure CI Pipeline (Swap Scope)
**Priority**: P1 | **File**: `.github/workflows/ci.yml` (Create if missing)

### Objective
Automate linting and testing on every Pull Request to `main`.

### Tasks
1. Create a GitHub Actions workflow that triggers on `pull_request` and `push` to `main`.
2. Pipeline steps:
   - Checkout code
   - Setup Node.js (v18+)
   - `npm ci`
   - `npm run lint`
   - `npm run test` (Crucially, this must run `swapEngine.test.ts` and `swapStore.test.ts`)
3. **Strict Policy**: Fail the pipeline immediately if any swap-related test fails.
4. *(Server)* Add a Docker build check step in the CI to ensure `server/Dockerfile` builds cleanly without deploying.

---

## 📦 Ticket: RM-SW-051 — Production Build & APK Generation
**Priority**: P1 | **Files**: `eas.json`, `app.json`

### Objective
Generate the V1 APK containing only the Seat Swap feature.

### Tasks
1. Validate `app.json` branding, ensuring the splash screen is correctly pointing to the RailMitra assets.
2. Configure `eas.json` with a `preview` or `production` build profile targeted solely for Android (APK, not just AAB, so it can be distributed out-of-band locally).
3. Execute `eas build -p android --profile preview`.
4. Run standard binary size checks (goal is under 30MB) and ensure no unnecessary heavy assets from V2 features are bundled.

---

## 🌐 Ticket: RM-SW-052 — Backend Deployment Validation
**Priority**: P1

### Objective
Ensure the Node.js Seat Swap Sync server deployed on Render is actually alive, connected to the DB, and properly handling web sockets.

### Tasks
1. Write a lightweight verification script (`scripts/verify-deploy.ts` or curl commands):
   - Check `GET /api/health` returns `200 OK` and explicitly confirms `status: "healthy"` (meaning Prisma DB connected).
   - Check `GET /api/metrics` is exposed and returning shapes.
2. Formulate an SSE Stream test script:
   - Connect to `/api/swaps/99999/2026-12-31/stream`.
   - Validate receipt of the initial `CONNECTED` payload.
3. Formulate an End-to-End API test:
   - `POST` a dummy swap offer to production.
   - `GET` the browse list to verify it appears.
   - `POST` a cancel command to clean up production state.
