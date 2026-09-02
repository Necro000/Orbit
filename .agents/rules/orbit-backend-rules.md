# Orbit — Agent Standing Rules

## 1. Project Identity
This is the **Orbit** monorepo — a cloud file storage and sharing web app.
- Frontend: `apps/web` (Next.js 16, React 19, Tailwind CSS v4)
- Backend API: `apps/api` (Express, TypeScript strict, Zod validation)
- Database: PostgreSQL via `pg` Pool (no ORM)
- Background Jobs: BullMQ + Redis + Sharp
- Storage: S3 / Supabase Storage abstraction in `apps/api/src/lib/storage.ts`

---

## 2. Absolute UI/UX Lock — DO NOT MODIFY

The following files and directories are **off-limits for all modifications** unless the user explicitly says "change the UI" or "update the design":

### Protected Directories (Backend Agent — No Touch)
- `apps/web/components/**` — All React UI components
- `apps/web/app/**/page.tsx` — All Next.js route pages
- `apps/web/app/layout.tsx` — Root layout
- `apps/web/app/globals.css` — Global CSS
- `apps/web/postcss.config.mjs` — PostCSS config
- `apps/web/tailwind.config.*` — Tailwind config (if added)
- `Docs/design-system.md` — Design tokens and style guide
- `Docs/ui-components.md` — Component documentation

### Why
The design system, color palette, animations, and component library are already finalized. Any unintended style changes would require QA review.

---

## 3. Backend Error-Fix Protocol

When diagnosing any error, follow this exact order:

1. **Run `pnpm typecheck` first** — fix all TypeScript errors before any other changes.
2. **Check SQL SELECT fields** — verify all fields in every `FileRow`, `FolderRow`, `ShareRow` TypeScript cast appear in the query SELECT list.
3. **Check status filters** — use `is_deleted = false AND status = 'ready'` NOT `status != 'trashed'`.
4. **Check camelCase/snake_case contracts** — API JSON must match frontend TypeScript interface property names exactly.
5. **Guard all `result.rows[0]`** — add `if (!row) { res.status(404)... }` before using any optional DB row.
6. **Run `pnpm build` last** — production builds must pass with exit code 0.

---

## 4. Coding Standards

### API Routes
- All routes use `void (async () => { ... })();` pattern.
- Error responses MUST use: `{ error: { code: 'SCREAMING_SNAKE', message: '...' } }`
- HTTP status codes must be correct: `404` for not found, `403` for forbidden, `400` for validation, `409` for conflicts, `410` for expired resources.
- Zod validation on every request body and params schema.

### Database
- Parameterized queries only — no string concatenation with user input.
- Use `resolveAccess()` from `apps/api/src/lib/acl.ts` for ALL resource authorization.
- Guard `result.rows[0]` with null-checks before property access.
- Status lifecycle: `files.status` valid values are `'uploading'` | `'ready'` (not `'trashed'`).
- Soft-delete: always filter with `is_deleted = false` for active records.

### API Response Shape Contracts
Keep frontend lib interfaces in sync with API response shapes:

| Frontend Interface File | Key Contract Rules |
| :--- | :--- |
| `apps/web/lib/shares.ts → LinkShareEntry` | camelCase: `resourceType`, `resourceId`, `expiresAt`, `createdAt`, `hasPassword` |
| `apps/web/lib/shares.ts → ShareEntry` | snake_case: `grantee_name`, `grantee_email`, `grantee_user_id`, `resource_type` |
| `apps/web/lib/folders.ts → FileItem` | must include: `folder_id`, `owner_id`, `mime_type`, `size_bytes` |
| `apps/web/lib/auth.ts → CurrentUser` | camelCase: `imageUrl`, `storageUsedBytes` |

---

## 5. Migration Rules

- All 5 migrations must be applied: `001_users.sql` through `005_file_versions.sql`.
- Use `pnpm db:migrate` (automated runner in `apps/api/src/scripts/migrate.ts`) — do NOT apply migrations manually by default.
- Migrations are idempotent: tracked via `_migrations_history` table.

---

## 6. Deployment Rules

- `pnpm build` must pass with exit code 0 before any deployment.
- `pnpm typecheck` must pass with exit code 0.
- Production: use `docker-compose.prod.yml` at workspace root.
- Environment variables must never be committed to git — use `.env` (gitignored).
- API healthcheck: `GET /health` returns `{ status: 'healthy', database: 'connected' }`.

---

## 7. Known Bugs Registry (Resolved)

| Bug ID | Location | Fixed |
| :--- | :--- | :--- |
| ORB-001 | Missing `/link/[token]` route | ✅ `apps/web/app/link/[token]/page.tsx` created |
| ORB-002 | Wrong status filter in storage query | ✅ `is_deleted = false AND status = 'ready'` |
| ORB-003 | `folder_id` missing in shared files query | ✅ Added `fl.folder_id` |
| ORB-004 | `owner_id`, `folder_id` missing in starred files | ✅ Added to SELECT |
| ORB-005 | `linkShare` POST returned snake_case only | ✅ Normalized to camelCase + aliases |
| ORB-006 | `result.rows[0]` unguarded in `linkShares.ts` | ✅ Added null guard |
| ORB-007 | Share creation missing grantee user details | ✅ Added JOIN to users |
| ORB-008 | No `output: standalone` in `next.config.ts` | ✅ Added for Docker |
| ORB-009 | No automated migration runner | ✅ `pnpm db:migrate` created |
| ORB-010 | No `/health` endpoint | ✅ Added to `apps/api/src/index.ts` |
