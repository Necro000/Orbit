# Orbit 🪐

**Orbit** is a modern, high-performance cloud media and file storage web application built for seamless personal and team file management. It provides end-to-end file lifecycle management — including nested folder navigation, direct-to-storage multipart uploads, high-speed parameterized search, role-based sharing (Viewer/Editor), password-protected public link sharing with expiry, activity logging, and soft-delete trash with automatic purge.

---

## 🚀 Tech Stack

- **Frontend**: [Next.js 15](https://nextjs.org/) (App Router), React 19, TypeScript, [Tailwind CSS](https://tailwindcss.com/), [TanStack Query](https://tanstack.com/query), and Lucide Icons.
- **Backend API**: [Node.js](https://nodejs.org/) & [Express](https://expressjs.com/) (RESTful API), TypeScript, [Zod](https://zod.dev/) validation, and Helmet security.
- **Database**: [PostgreSQL](https://www.postgresql.org/) (via Supabase or local Postgres) with strict constraints, recursive CTE access resolution, and SQL migrations.
- **Object Storage**: S3-compatible / Supabase Storage abstraction with direct-to-storage signed URLs.
- **Job Queue & Previews**: [BullMQ](https://bullmq.io/) + [Redis](https://redis.io/) background worker with [Sharp](https://sharp.pixelplumbing.com/) for high-fidelity thumbnail generation.
- **Authentication**: Stateless JWT access & refresh tokens with rotation and `httpOnly` secure cookies.

---

## 📂 Repository Structure

```
Orbit/
├── apps/
│   ├── api/             # Express REST backend (port 8080)
│   └── web/             # Next.js App Router frontend (port 3000)
├── packages/
│   └── config/          # Shared ESLint, Prettier, and TypeScript configurations
├── infra/
│   ├── docker-compose.yml # Local Postgres and Redis container definitions
│   ├── LOCAL_SETUP.md     # Detailed local database & infrastructure setup guide
│   ├── migrations/        # Sequential SQL database migration scripts (001-004)
│   └── storage/           # Local disk storage directory for dev environment
├── Docs/
│   ├── Context.md                 # Product rationale, scope, and user flows
│   ├── architecture.md            # System design, data model, security & API specs
│   ├── Implementation-phase-plan.md # Sprint-by-sprint implementation phase plan
│   ├── edge-case.md               # Known edge cases, security & failure modes
│   └── brain.md                   # AI agent rules, conventions, and standing context
├── task.md              # Project task status & blocker tracker
└── package.json         # Workspace root configuration (pnpm)
```

---

## 🛠️ Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) >= 18.18 (Node 20+ recommended)
- [pnpm](https://pnpm.io/) >= 9.x
- [PostgreSQL](https://www.postgresql.org/) >= 15 & [Redis](https://redis.io/) >= 7 (via Docker Compose or native)

### 2. Infrastructure Setup
Refer to [infra/LOCAL_SETUP.md](file:///d:/Innovexis%20Internship%20Program/Orbit/infra/LOCAL_SETUP.md) for step-by-step instructions on starting PostgreSQL & Redis and applying migrations.

Quick start with Docker:
```bash
docker compose -f infra/docker-compose.yml up -d
```

Apply all database migrations automatically:
```bash
# Automatically applies migrations 001 through 005 idempotently
pnpm db:migrate
```

Or manually using `psql`:
```bash
psql "postgres://orbit:orbit_secret@localhost:5432/orbit" -f infra/migrations/001_users.sql
psql "postgres://orbit:orbit_secret@localhost:5432/orbit" -f infra/migrations/002_folders_and_files.sql
psql "postgres://orbit:orbit_secret@localhost:5432/orbit" -f infra/migrations/003_shares_and_search.sql
psql "postgres://orbit:orbit_secret@localhost:5432/orbit" -f infra/migrations/004_trash_and_activity.sql
psql "postgres://orbit:orbit_secret@localhost:5432/orbit" -f infra/migrations/005_file_versions.sql
```

### 3. Environment Variables
Copy `.env.example` to `.env` and fill in secrets:
```bash
cp .env.example .env
```

### 4. Install & Run Commands

```bash
# Install workspace dependencies
pnpm install

# Start both frontend and backend concurrently in dev mode
pnpm dev

# Run workspace unit and integration test suite
pnpm test

# Run typechecks and production builds
pnpm build
```

### 5. Production Docker Deployment

Deploy the entire Orbit stack (PostgreSQL, Redis, Express API, Next.js Web) in production mode:

```bash
docker compose -f docker-compose.prod.yml up --build -d
```

Check service health:
- API Healthcheck: `GET http://localhost:8080/health`
- Web Dashboard: `http://localhost:3000`

---

## 📖 Detailed Documentation & Specifications

- [Context & User Stories](file:///d:/Innovexis%20Internship%20Program/Orbit/Docs/Context.md)
- [Architecture & Security Specs](file:///d:/Innovexis%20Internship%20Program/Orbit/Docs/architecture.md)
- [Implementation Phase Plan](file:///d:/Innovexis%20Internship%20Program/Orbit/Docs/Implementation-phase-plan.md)
- [Edge Cases & Error Handling Guide](file:///d:/Innovexis%20Internship%20Program/Orbit/Docs/edge-case.md)
- [Agent Standing Context & Rules](file:///d:/Innovexis%20Internship%20Program/Orbit/Docs/brain.md)
