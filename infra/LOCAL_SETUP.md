# Orbit — Local Infrastructure & Database Setup

This document outlines the local development setup for Orbit's database and background services.

---

## Option 1: Docker Compose (Default / Containerized)

If Docker / Docker Desktop is installed and running on your machine:

1. **Start PostgreSQL & Redis**:
   ```bash
   docker compose -f infra/docker-compose.yml up -d
   ```
   - PostgreSQL runs on `localhost:5432` with user `orbit`, password `orbit_secret`, database `orbit`.
   - Redis runs on `localhost:6379`.

2. **Apply Migrations**:
   ```bash
   psql "postgres://orbit:orbit_secret@localhost:5432/orbit" -f infra/migrations/001_users.sql
   ```

3. **Configure Environment** in `.env`:
   ```env
   DATABASE_URL=postgres://orbit:orbit_secret@localhost:5432/orbit
   ```

---

## Option 2: Native PostgreSQL (No Docker Required)

If Docker is not available on the development machine (e.g. Windows without Docker Desktop), use the native PostgreSQL server.

### 1. Initialize Cluster (if setting up fresh local data in `infra/pgdata`)
```powershell
initdb -D infra/pgdata -U postgres_admin -A scram-sha-256
```

### 2. Start PostgreSQL Daemon on Port 5433
```powershell
postgres -D infra/pgdata -p 5433
```
*(Port 5433 is used to avoid conflicts if a default Windows PostgreSQL service is on 5432).*

### 3. Create Application Role & Database
```powershell
psql -h 127.0.0.1 -p 5433 -U postgres_admin -d postgres -c "CREATE ROLE orbit WITH LOGIN PASSWORD 'orbit_secret' NOSUPERUSER NOCREATEDB;"
createdb -h 127.0.0.1 -p 5433 -U postgres_admin -O orbit orbit
```
> **Security Note:** The `orbit` role is explicitly configured with `NOSUPERUSER` and `NOCREATEDB`, granting access strictly to the `orbit` database.

### 4. Apply Migrations
```powershell
psql -h 127.0.0.1 -p 5433 -U orbit -d orbit -f infra/migrations/001_users.sql
```

### 5. Authentication Method
Connections authenticate via `scram-sha-256` password authentication defined in `pg_hba.conf`:
```text
host all all 127.0.0.1/32 scram-sha-256
host all all ::1/128      scram-sha-256
```

### 6. Configure Environment in `.env`
```env
DATABASE_URL=postgres://orbit:orbit_secret@127.0.0.1:5433/orbit
```
