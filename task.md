# Orbit — Task & Milestone Tracker

## Phase 0 — Scaffolding (pre-Sprint 1)
- [x] Monorepo structure (`apps/web`, `apps/api`, `packages/config`, `infra/`)
- [x] Local Postgres and storage adapter setup
- [x] Linting, Prettier, TypeScript strict configuration
- [x] GitHub Actions CI workflow
- [x] `.env.example` and local setup guides

## Phase 1 — Auth & Base UI (Sprint 1)
- [x] JWT access/refresh token rotation + httpOnly cookies
- [x] Registration, Login, Logout, and `GET /api/auth/me`
- [x] Protected route middleware
- [x] App shell (Sidebar, Header, Breadcrumbs, Navigation)
- [x] `users` database table migration

## Phase 2 — Files Core (Sprint 2)
- [x] `folders` and `files` schema with cycle prevention and parent uniqueness constraints
- [x] Folder CRUD (create, rename, move, soft-delete)
- [x] Multipart direct upload initialization (`POST /api/files/init`) and completion (`POST /api/files/complete`)
- [x] Upload dropzone UI and multi-file progress drawer
- [x] Grid/List view with sorting, context menus, and signed download URLs

## Phase 3 — Sharing & Search (Sprint 3)
- [x] Single source of truth recursive CTE access control (`resolveAccess()`)
- [x] Per-user sharing (`shares` table, Viewer/Editor roles) and Shared view
- [x] Public link shares (`link_shares` table, password hashing, expiry check, dedicated brute-force rate limiter)
- [x] Starred files/folders API & view
- [x] Parameterized search API with name/type/owner filters and UI search bar
- [x] Recent activity & files view

## Phase 4 — Polish & Ops (Sprint 4)
- [x] Trash view, restore API/UI, and automated 30-day purge scheduler
- [x] Activity feed audit log (`activities` table) and item details panel
- [x] Real BullMQ + Redis + Sharp thumbnail preview generation pipeline for images with single startup tool detection
- [x] Sliding-window rate limiting middleware (general + upload-init + link-password)
- [x] Security headers (Helmet CSP, Referrer-Policy, strict CORS)
- [x] Root `README.md` and updated setup documentation
- [ ] **Sentry/structured logging/uptime checks — BLOCKED:** no Sentry DSN or hosting target configured in this dev environment. Revisit at deploy time.
- [ ] **Backup/restore drill — BLOCKED:** requires a real staging/production database; not applicable to local dev Postgres. Revisit at deploy time.

## Phase 5a — Version History (Slice 1 of Post-MVP)
- [x] Database migration `005_file_versions.sql` with schema and existing file backfill
- [x] Version retention policy (10 versions max) documented in `architecture.md §12`
- [x] Race-safe version allocation via transaction & `SELECT FOR UPDATE`
- [x] Architecture-compliant storage keys with `-v{n}` suffix
- [x] Multi-version upload flow (`POST /api/files/init` + `POST /api/files/complete`)
- [x] Version history API (`GET /api/files/:id/versions`) with `resolveAccess` authorization
- [x] Atomic revert endpoint (`POST /api/files/:id/versions/:versionId/revert`) with optimistic concurrency (`409 VERSION_CONFLICT`)
- [x] BullMQ background version pruning pipeline (`prune-versions`) deleting old DB rows and storage objects
- [x] Role-based access enforcement (Owner/Editor can upload/revert; Viewer/Outsider blocked)
- [x] Frontend `<VersionList>` component integrated into `<DetailsPanel>` Versions tab with confirmation modal
- [x] Automated test suite covering upload, revert, 409 conflicts, role matrix, 404 pruned revert, retention pruning, and backfill

## Phase 5+ — Remaining Deferred Backlog
- [ ] Full-text content search (`tsvector` / `pg_trgm`)
- [ ] Shared team drives & quota management
- [ ] Keyboard shortcuts & i18n localization

