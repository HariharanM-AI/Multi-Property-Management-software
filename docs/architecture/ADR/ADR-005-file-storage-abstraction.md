# ADR-005: Storage Abstraction (Google Cloud Storage & Local Driver)

## Status
Accepted

## Context
Storing large files (KYC Aadhaar/PAN cards, property photos, lease agreements, receipts) directly in PostgreSQL degrades database performance, balloons backup sizes, and increases storage costs.

## Decision
- Implement a `StorageService` interface abstraction.
- Support two drivers:
  1. `LocalFileStorageDriver`: Stores uploaded files in `./uploads` with UUID naming for local offline, zero-cost development.
  2. `GcsStorageDriver`: Streams files to Google Cloud Storage private buckets for production.
- Only store document metadata (UUID, MIME type, size, bucket path, upload timestamp) in PostgreSQL.
- Require authenticated server proxy or short-lived signed URLs for downloading KYC and sensitive documents.

## Consequences
### Positive
- Zero cloud cost and no external dependencies during local development.
- Enterprise-grade, scalable, and secure document storage in production.
