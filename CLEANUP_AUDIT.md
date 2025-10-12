# Cleanup Audit Report
**Generated**: 2025-10-12
**Purpose**: Identify all files and categorize as KEEP, REMOVE, or REVIEW

---

## ACTIVE SERVICES (KEEP ✅)

### Backend Services (KEEP)
1. **server/index.js** ✅ - Main Fastify server
2. **server/routes/cnQuickstartRoutes.js** ✅ - Active CN Quickstart API endpoints
3. **server/routes/init.js** ✅ - Initialization endpoint (used by /api/init)
4. **server/services/jsonApiV1Service.js** ✅ - Query service for Holdings/Proposals
5. **server/sdkManager.js** ✅ - Canton Wallet SDK manager (still used by init/daml routes)

### Frontend Services (KEEP)
1. **src/services/cnQuickstartFrontendService.js** ✅ - Active frontend service
2. **src/services/cnQuickstartLedgerService.js** ✅ - Backend ledger operations (JSON API v2)
3. **src/services/storageService.js** ✅ - LocalStorage persistence

### Frontend App (KEEP)
1. **src/App.jsx** ✅ - Main React app
2. **src/main.jsx** ✅ - React entry point
3. **src/index.css** ✅ - Styles
4. **index.html** ✅ - HTML entry point

### DAML Contract (KEEP)
1. **daml/minimal-token/daml/MinimalToken.daml** ✅ - Current v1.0.0 contract
2. **daml/minimal-token/daml.yaml** ✅ - DAML project config

### Configuration (KEEP)
1. **src/config/packageConfig.js** ✅ - Centralized package ID config
2. **package.json** ✅ - NPM dependencies
3. **package-lock.json** ✅ - NPM lock file
4. **pnpm-lock.yaml** ✅ - pnpm lock file
5. **vite.config.js** ✅ - Vite build config
6. **.gitignore** ✅ - Git ignore rules
7. **.env.server.example** ✅ - Environment variable template

### Scripts (KEEP)
1. **scripts/upload_dar.sh** ✅ - Main DAR upload script (shell, auto-detects version)
2. **scripts/upload_dar.py** ✅ - Alternative Python upload script
3. **vet_dar.py** ✅ - Standalone vetting script
4. **get_party_id.sh** ✅ - Helper to get current party ID from Canton logs
5. **scripts/start-server.js** ✅ - Server startup script (used by npm run server:start)

---

## UNUSED SERVICES (REMOVE ❌)

### Backend Services NOT Used
1. **server/routes/daml.js** ❌ - Old DAML routes (NOT imported in server/index.js line 10-11 but NOT actually registered!)
   - Imports: cantonConsoleService, mockCantonService, damlLedgerService, sdkManager
   - Status: Route file exists but routes never registered to Fastify app
   - Check: `grep "damlRoutes" server/index.js` shows import but no `.register(damlRoutes)`

2. **server/services/grpcLedgerService.js** ❌ - Never imported anywhere
   - Contains: gRPC state service implementation
   - Status: Dead code

### Frontend Services NOT Used
1. **src/services/cantonConsoleService.js** ❌ - Only imported in server/routes/daml.js (which is not used)
2. **src/services/mockCantonService.js** ❌ - Only imported in server/routes/daml.js (which is not used)
3. **src/services/damlLedgerService.js** ❌ - Only imported in server/routes/daml.js (which is not used)
4. **src/services/frontendCantonService.js** ❌ - Never imported anywhere
5. **src/services/cnQuickstartGrpcService.js** ❌ - Never imported anywhere
6. **src/services/cnQuickstartGrpcBalanceService.cjs** ❌ - Imported in cnQuickstartRoutes.js line 13 but NEVER CALLED

### Protobuf Files
1. **server/services/protos/state_service.proto** ❌ - Used by grpcLedgerService.js (which is unused)

---

## DOCUMENTATION (REVIEW 📋)

### Active Documentation (KEEP)
1. **README.md** ✅ - Main project README (needs updating)
2. **CONTEXT.md** ✅ - Technical context and status (recently updated)
3. **CLAUDE.md** ✅ - AI assistant instructions
4. **.cursorrules** ✅ - Code style conventions

### Documentation to Review
1. **docs/GETTING_STARTED.md** 📋 - Quick start guide (duplicate of root file?)
2. **docs/USER_FLOW.md** 📋 - Detailed user flow (recently created, keep?)
3. **docs/QUICK_REFERENCE.md** 📋 - Quick commands (recently created, keep?)
4. **docs/DAR_UPLOAD_GUIDE.md** 📋 - DAR upload guide (recently created, keep?)
5. **docs/VETTING_STATUS.md** 📋 - Vetting troubleshooting (recently created, keep?)

### Obsolete Documentation (REMOVE ❌)
1. **docs/PRD.md** ❌ - Product requirements doc (outdated, project evolved)
2. **docs/REPRO.md** ❌ - Old bug reproduction steps
3. **docs/SOLUTION.md** ❌ - Old bug solution
4. **docs/UPLOAD_DAR_TO_CANTON.md** ❌ - Superseded by DAR_UPLOAD_GUIDE.md
5. **docs/UPLOAD_SUMMARY.md** ❌ - Old upload summary

---

## SCRIPTS (REVIEW 📋)

### Obsolete Scripts (REMOVE ❌)
1. **scripts/upload-dar-to-canton.sh** ❌ - Superseded by scripts/upload_dar.sh
2. **scripts/start-daml-json-api.sh** ❌ - Not used (CN Quickstart has built-in JSON API)
3. **scripts/configure-localnet-auth.sh** ❌ - Old auth script
4. **scripts/daml-build.js** ❌ - Not used (use `daml build` directly)
5. **scripts/allocate-party.md** ❌ - Documentation in wrong location
6. **scripts/canton-console-commands.md** ❌ - Old commands
7. **scripts/canton-console-test.sc** ❌ - Test script (not needed)
8. **scripts/quick-canton-check.sc** ❌ - Old check script
9. **onboard-party.sc** ❌ - Old onboarding script (root level)
10. **quick-test.sh** ❌ - Old test script (root level)
11. **test-flow.sh** ❌ - Old test script (root level)
12. **test-proposal-flow.sh** ❌ - Old test script (root level)

---

## BUILD ARTIFACTS (REMOVE ❌)
1. **__pycache__/upload_dar.cpython-313.pyc** ❌ - Python cache
2. **server.log** ❌ - Log file (should be in .gitignore)

---

## IDE/TOOL CONFIG (KEEP ✅)
1. **.claude/settings.local.json** ✅ - Claude Code settings

---

## SUMMARY

### Files to KEEP: 30
- Backend: 5 files
- Frontend: 7 files
- DAML: 2 files
- Config: 7 files
- Scripts: 5 files
- Docs: 4 files

### Files to REMOVE: 26
- Unused services: 8 files
- Obsolete docs: 5 files
- Obsolete scripts: 11 files
- Build artifacts: 2 files

### Files to REVIEW: 5
- Documentation that needs consolidation/updating

---

## PROPOSED CLEANUP ACTIONS

### Phase 1: Safe Removals (Low Risk)
1. Remove build artifacts (__pycache__, server.log)
2. Remove obsolete documentation (PRD.md, REPRO.md, SOLUTION.md, etc.)
3. Remove obsolete scripts (upload-dar-to-canton.sh, test scripts, etc.)

### Phase 2: Service Cleanup (Medium Risk - Verify First)
1. Verify server/routes/daml.js is NOT registered in server/index.js
2. Remove unused services (cantonConsoleService, mockCantonService, etc.)
3. Remove server/routes/daml.js
4. Remove grpcLedgerService and state_service.proto

### Phase 3: Documentation Consolidation (Low Risk)
1. Update README.md as main entry point
2. Consolidate getting started docs
3. Move all essential docs to docs/ directory
4. Remove duplicates

### Phase 4: Final Verification
1. Test full flow: wallet → token → mint → burn
2. Verify all imports resolve
3. Verify no broken links in documentation
4. Run `npm run build` to ensure frontend builds
5. Run `npm run server:start` to ensure backend starts
