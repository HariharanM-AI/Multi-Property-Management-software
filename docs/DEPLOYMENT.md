# PropertyOS — Production Deployment & Operational Runbook

## 1. Production Architecture Overview
PropertyOS runs as an enterprise-grade multi-tenant platform with the following core components:
- **Web Client**: Next.js 15 App Router (`apps/web`) running in standalone Node.js mode.
- **API Server**: NestJS 11 (`apps/api`) serving REST endpoints with strict multi-tenant scoping and RBAC.
- **Relational Database**: PostgreSQL 16 with connection pooling and SSL encryption.
- **Background Queue & Automation**: Redis 7 running BullMQ 5.41 for scheduled jobs, retry pipelines, and dead-letter queues.
- **Storage Layer**: Local filesystem (`uploads/`) with UUID sanitization or Google Cloud Storage (GCS) abstraction.

---

## 2. Environment Configuration Matrix

| Variable | Description | Production Requirement | Example / Format |
| :--- | :--- | :---: | :--- |
| `NODE_ENV` | Runtime environment | **Required** | `production` |
| `PORT` | API listening port | **Required** | `4000` |
| `DATABASE_URL` | PostgreSQL connection string | **Required** | `postgresql://user:pass@host:5432/propertyos?sslmode=require` |
| `REDIS_URL` | Redis 7 connection string | **Required** | `redis://:pass@host:6379` or `rediss://` (TLS) |
| `SESSION_SECRET` | 64-char high-entropy cookie secret | **Required** | Cryptographically random 256-bit string |
| `NEXT_PUBLIC_API_URL` | Base API URL for frontend | **Required** | `https://api.propertyos.in/api/v1` |
| `CORS_ORIGIN` | Allowed web frontend origin | **Required** | `https://app.propertyos.in` |

---

## 3. Production Deployment Procedure

### Step 1: Pre-Flight Environment Validation
Verify all production environment variables are provisioned in the secure secrets manager (e.g. AWS Secrets Manager / Vault / GCP Secret Manager).

### Step 2: Database Migration
Execute non-destructive database migrations:
```bash
npx prisma migrate deploy
```
*(Never run `prisma migrate reset` or `prisma db push` against production).*

### Step 3: API & Worker Process Startup
1. Build the API artifact:
   ```bash
   npm run build --workspace=@propertyos/api
   ```
2. Start the API application process:
   ```bash
   node apps/api/dist/main.js
   ```

### Step 4: Next.js Frontend Process Startup
1. Build the Web bundle:
   ```bash
   npm run build --workspace=@propertyos/web
   ```
2. Start the production web server:
   ```bash
   npm run start --workspace=@propertyos/web
   ```

### Step 5: Health & Dependency Verification
Verify application health via the diagnostic endpoint:
```bash
curl -f https://api.propertyos.in/api/v1/health
```
Expected response:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "uptime": 120
}
```

---

## 4. Backup, Point-In-Time Recovery & Disaster Recovery

### PostgreSQL Database Backup Policy
- **Automated Nightly Dumps**: Standard `pg_dump` compressed snapshot taken at 02:00 UTC and archived to redundant object storage with 30-day retention:
  ```bash
  pg_dump -Fc -h $DB_HOST -U $DB_USER $DB_NAME > /backups/propertyos_$(date +%Y%m%d_%H%M%S).dump
  ```
- **Continuous Archiving (WAL / PITR)**: Write-Ahead Logging (WAL) shipping enabled to allow Point-In-Time Recovery to any second within the last 7 days.
- **RPO (Recovery Point Objective)**: $< 15\text{ minutes}$.
- **RTO (Recovery Time Objective)**: $< 60\text{ minutes}$.

### Redis & Queue Recovery
- BullMQ persistent execution state is mirrored in the PostgreSQL `job_executions` table.
- In the event of an unrecoverable Redis crash, restart Redis; active workers will rebuild queue topology automatically, and stalled or pending executions will be re-enqueued.

---

## 5. Rollback Procedure

If a critical defect is identified post-deployment:
1. **Traffic Switch**: Route load balancer / ingress traffic back to the previous stable release artifact.
2. **Database Reversion**: If migrations were additive (recommended standard), rollback does not require schema changes. If a column was added, previous application binaries ignore it.
3. **Queue Health**: Flush or pause the queue via `POST /api/v1/jobs/pause` if necessary while debugging.
4. **Post-Mortem**: Document incident in compliance audit log.
