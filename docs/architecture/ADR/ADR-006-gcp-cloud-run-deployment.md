# ADR-006: Google Cloud Run Target Deployment & Zero-Cost Baseline

## Status
Accepted

## Context
Deploying enterprise software often incurs unnecessary standing cloud infrastructure bills (e.g. always-on Kubernetes clusters or multi-node VMs).

## Decision
- Target **Google Cloud Run** for containerized stateless deployment of `apps/api` and `apps/web`.
- Configure `min-instances = 0` to scale compute to zero when inactive.
- Keep the local development environment completely runnable via Docker Compose (`postgis/postgis`, `redis`, local node services) without requiring GCP connectivity.

## Consequences
### Positive
- Negligible or zero idle hosting costs.
- High elasticity and auto-scaling during traffic spikes.
- Full local reproducibility on developer machines.
