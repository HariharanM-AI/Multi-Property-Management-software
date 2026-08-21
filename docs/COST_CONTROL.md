# PropertyOS — Cost Control & Infrastructure Optimization

## 1. Cost Philosophy
PropertyOS is designed to operate at **zero or near-zero cost during development and Phase 1**, scaling cost linearly with active paying property owners.

---

## 2. Local Development (Zero Cost)
- **Local Runtime**: The entire environment (PostgreSQL with PostGIS, Redis, NestJS API, Next.js Web) executes locally via Docker Compose or native Node.js.
- **Storage Driver**: A local filesystem storage driver (`STORAGE_DRIVER=local`) stores uploaded documents in `./uploads` during development without requiring Google Cloud Storage credentials or network costs.
- **Zero Paid Subscriptions**: No external paid SaaS services or proprietary APIs are mandatory for local operations and testing.

---

## 3. Google Cloud Target Deployment Strategy (Minimal Cost)
When deploying to Google Cloud Platform:
1. **Google Cloud Run (Compute)**:
   - Configure container instances to **scale to 0** when idle (`min-instances = 0`).
   - Allocate 512MB - 1GB RAM and 1 vCPU with concurrency set to 80 requests/instance.
   - Use Google Cloud Run free tier allowances (2M requests/month, 360,000 vCPU-seconds, 180,000 GiB-seconds free).
2. **Cloud SQL / Managed PostgreSQL**:
   - For early staging, use Cloud Run + lightweight VM / self-hosted PostgreSQL or Cloud SQL db-f1-micro with automatic storage increase disabled.
3. **Google Cloud Storage (GCS)**:
   - Configure Object Lifecycle Management: Move archived/historical tenant documents to `Nearline` or `Coldline` storage after 90 days.
   - Keep bucket versioning disabled unless compliance mandates it to prevent duplicate storage costs.
4. **Artifact Registry**:
   - Set cleanup policies to retain only the last 3 tagged container images, automatically pruning stale intermediate layers.
