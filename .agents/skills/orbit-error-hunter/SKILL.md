---
name: orbit-error-hunter
description: >-
  Step-by-step backend error diagnosis and fix playbook for the Orbit monorepo.
  Covers API route integrity, SQL query field completeness, data-contract
  mismatches, TypeScript safety, migration pipeline, and production build
  verification — all WITHOUT touching UI/UX components or styles.
---

# Orbit Error Hunter — Backend Diagnosis Skill

## CRITICAL CONSTRAINT
**NEVER modify any of the following. Read them if needed, but treat them as read-only:**
- `apps/web/app/**/page.tsx` (route pages)
- `apps/web/components/**/*.tsx` (all React components)
- `apps/web/app/globals.css` (global styles)
- `apps/web/app/layout.tsx` (root layout)
- Any `.css`, `.scss`, Tailwind config, PostCSS config, or design token file
- `Docs/design-system.md`, `Docs/ui-components.md`

---

## Workflow: Error Hunting Procedure

Run every step in order. Do **not** skip a step.

---

### Step 1 — Run the Static Analysis Suite

Run these in parallel:

```bash
pnpm typecheck                        # TypeScript errors across all packages
pnpm lint                             # ESLint across all packages
pnpm --filter @orbit/api build        # API tsc compilation
pnpm --filter @orbit/web build        # Next.js Turbopack production build
```

Collect all errors. Categorize into:
- **TS errors** → type mismatches, `possibly undefined`, missing fields
- **Lint warnings** → import order, complexity, line count
- **Build errors** → missing modules, bad config

---

### Step 2 — Check API → DB Data Contract & Mutation Parity

For each API route in `apps/api/src/routes/*.ts`:

1. **SELECT Queries**: Open the route file and list every SQL `SELECT` statement. Cross-reference with the TypeScript interface it's cast to (e.g., `FileRow`, `FolderRow`, `ShareRow`). Verify ALL interface fields appear in the `SELECT` list.
2. **UPDATE / INSERT Mutations**: List every column updated or inserted (e.g. `updated_at`, `password_hash`, `storage_used_bytes`). Cross-reference each column with `infra/migrations/*.sql` table definitions to ensure the column exists in the database schema.

**Common missing fields & columns to check:**
| Field / Column | Often missing in | Impact |
| :--- | :--- | :--- |
| `updated_at` | `users` table (`001_users.sql`) vs `auth.ts` | 500 crash on password & profile update |
| `folder_id` | `stars.ts`, `shared.ts` GET queries | Broken folder navigation |
| `owner_id` | `stars.ts`, `recent.ts` GET queries | Broken ownership badges |
| `is_deleted` | trash queries | Incorrect file listings |
| `storage_key` | files queries for download | 500 on file download |

---

### Step 3 — Check API → Frontend JSON Contract

For each API endpoint, compare:
- What the API **returns** (response JSON shape)
- What the frontend **expects** (TypeScript interface in `apps/web/lib/*.ts`)

Key contracts to verify:

| Frontend Interface | API Endpoint | Expected Shape |
| :--- | :--- | :--- |
| `LinkShareEntry` | `POST /api/link-shares` | camelCase: `resourceType`, `resourceId`, `expiresAt`, `createdAt`, `hasPassword` |
| `ShareEntry` | `POST /api/shares` | Includes `grantee_name`, `grantee_email`, `role` |
| `FileItem` | `GET /api/files/:id` | `downloadUrl`, `streamUrl`, `role` |
| `CurrentUser` | `GET /api/auth/me` | `imageUrl`, `storageUsedBytes` camelCase |
| `ActivityItem` | `GET /api/activities/:type/:id` | `actor_name`, `actor_email` |

---

### Step 4 — Check Storage & Status Filters

Every SQL `WHERE` clause that filters files must use:
```sql
AND is_deleted = false AND status = 'ready'
```
NOT `status != 'trashed'` (files do not use a `'trashed'` status value).

Check these routes:
- `auth.ts` → `storage_used_bytes` subquery
- `stars.ts` → starred files query
- `shared.ts` → shared files query
- `recent.ts` → recent files query
- `search.ts` → accessible_files CTE

---

### Step 5 — Check ACL Enforcement

Every route that accesses a resource MUST call `resolveAccess()` before the query:

```typescript
const access = await resolveAccess(userId, resourceType, resourceId);
if (!access.canRead) {
  res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', ... } });
  return;
}
```

Check all routes: `files.ts`, `folders.ts`, `shares.ts`, `linkShares.ts`, `stars.ts`, `activities.ts`.

---

### Step 6 — TypeScript Safety Patterns

For every `result.rows[0]`, ensure a guard exists:

```typescript
// BAD — TS18048
const row = result.rows[0];
res.json({ id: row.id }); // ERROR: row possibly undefined

// GOOD
const row = result.rows[0];
if (!row) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  return;
}
res.json({ id: row.id });
```

---

### Step 7 — Migration Completeness Check

Verify all 5 migration files are referenced in `pnpm db:migrate` runner:

| File | Tables Created |
| :--- | :--- |
| `001_users.sql` | `users`, `refresh_tokens` |
| `002_folders_and_files.sql` | `folders`, `files` |
| `003_shares_and_search.sql` | `shares`, `link_shares`, `stars` |
| `004_trash_and_activity.sql` | `activities` |
| `005_file_versions.sql` | `file_versions` |

---

### Step 7b — Check Error Contracts & Toast Resilience

Verify error handling across frontend clients and API calls:

1. **HTTP/2 Empty `statusText` Guard**: In modern browsers under HTTP/2, `res.statusText` is `""`. Ensure `apiFetch` in `apps/web/lib/api.ts` always provides a non-empty fallback message and extracts error payloads from `{ error: { message } }`, flat `{ error }`, and `{ message }`.
2. **Substance Over Identity in Catch Blocks**: Never use `const msg = err instanceof ApiError ? err.message : fallback`. If `err.message` is `""`, the fallback is bypassed. Always use:
   ```typescript
   const msg = (err instanceof ApiError && err.message?.trim()) ? err.message : fallback;
   ```
3. **Stale Session Token Invalidation**: When an authenticated endpoint returns 404 with code `USER_NOT_FOUND`, the client must detect this as an expired session and guide the user to log out and re-authenticate.
4. **Form Input Symmetry**: All sensitive input fields (e.g. Current, New, and Confirm Password) must have visibility toggles to prevent undetected typographical mismatches.

---

### Step 8 — Final Verification

After ALL fixes, run this verification sequence:

```bash
pnpm typecheck          # Must exit 0
pnpm --filter @orbit/api build   # Must exit 0
pnpm --filter @orbit/web build   # Must exit 0, all routes appear
pnpm lint               # Warnings only — no errors
```

Verify Next.js route table includes:
- `ƒ /link/[token]`  ← public share page (was missing before)
- `ƒ /drive`
- `ƒ /shared`
- `ƒ /starred`
- `ƒ /recent`
- `ƒ /trash`

---

## Known Bug Registry (Orbit Project)

Issues found and fixed during Phase 1 diagnosis:

| Bug ID | File | Issue | Fix Applied |
| :--- | :--- | :--- | :--- |
| ORB-001 | `apps/web/app/link/[token]` | Route missing entirely — 404 for all public links | Created `page.tsx` with preview/download/password UI |
| ORB-002 | `apps/api/src/routes/auth.ts` | `storage_used_bytes` queried `status != 'trashed'` | Fixed to `is_deleted = false AND status = 'ready'` |
| ORB-003 | `apps/api/src/routes/shared.ts` | `folder_id` missing from shared files SELECT | Added `fl.folder_id` to SELECT list |
| ORB-004 | `apps/api/src/routes/stars.ts` | `owner_id`, `folder_id` missing from starred files SELECT | Added both to SELECT list |
| ORB-005 | `apps/api/src/routes/linkShares.ts` | POST response returned snake_case raw DB columns vs frontend camelCase expectation | Normalized to `resourceType`, `expiresAt`, `createdAt` |
| ORB-006 | `apps/api/src/routes/linkShares.ts` | `result.rows[0]` used without null-check causing TS18048 | Added `if (!createdRow)` guard |
| ORB-007 | `apps/api/src/routes/shares.ts` | POST response missing `grantee_name` and `grantee_email` in share creation | Added JOIN to users table on create |
| ORB-008 | `apps/web/next.config.ts` | Missing `output: 'standalone'` for Docker production build | Added `output: 'standalone'` |
| ORB-009 | `infra/migrations` | `005_file_versions.sql` omitted from README and no automated runner | Created `migrate.ts` runner + `pnpm db:migrate` command |
| ORB-010 | `apps/api/src/index.ts` | No database health probe endpoint | Added `GET /health` with `SELECT 1` check |
| ORB-011 | `infra/migrations/001_users.sql` | `users` table omitted `updated_at` column, causing 500 error in `auth.ts:360` on password update | Added `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()` to `001_users.sql` and database |
| ORB-012 | `apps/web/lib/api.ts` | HTTP/2 empty `statusText` and proxy errors produced `""` message in `ApiError`, rendering blank error toast | Hardened `apiFetch` with fallback messages and `USER_NOT_FOUND` session detection |
| ORB-013 | `apps/web/components/modals/SettingsModal.tsx` | Confirm password field lacked Show/Hide toggle, and catch block ternary bypassed fallback string | Added `showConfirmPass` toggle and substance-checking `.trim()` fallback guard |
