# PropertyOS — Enterprise Property Management Platform

> Unified, multi-tenant SaaS property management system engineered for the Indian market supporting PG/Co-Living and Whole-Unit Rental properties.

---

## 1. Project Philosophy & Phase 1 Scope
- **Zero AI / ML / LLM in Phase 1**: 100% deterministic, rule-based, relational data model and business logic.
- **Relational Source of Truth**: PostgreSQL 16 + PostGIS via Prisma ORM 6.
- **Modular Monolith**: Clean single monorepo with `apps/api` (NestJS) and `apps/web` (Next.js App Router).
- **Security First**: Argon2id password hashing, HTTP-only secure cookie sessions, 4-tier authorization chain (Auth → Org Tenancy → RBAC Roles → Resource Scoping), and zero wildcard CORS.
- **Strict Brand Design**: 3-color palette (`#FFFFFF`, `#0F172A`, `#0F766E`) with WCAG AA compliance.

---

## 2. Monorepo Structure
```
propertyos/
├── apps/
│   ├── api/                 # NestJS Modular Monolith API (/api/v1)
│   └── web/                 # Next.js App Router Frontend
├── packages/
│   ├── config/              # Shared configuration constants
│   ├── types/               # TypeScript domain interfaces and enums
│   └── validation/          # Shared Zod validation schemas
├── prisma/
│   └── schema.prisma        # PostgreSQL transactional schema (30+ models)
├── infrastructure/
│   ├── docker/              # Production & development Dockerfiles
│   └── gcp/                 # Google Cloud Run deployment scripts
├── docs/
│   ├── PROJECT_CONTEXT.md
│   ├── FEATURE_REGISTRY.md
│   ├── FEATURE_DEPENDENCIES.md
│   ├── SECURITY.md
│   ├── COST_CONTROL.md
│   ├── API.md
│   └── architecture/ADR/    # ADR-001 through ADR-007
├── docker-compose.yml       # Local PostgreSQL + PostGIS, Redis, API, Web
├── package.json
└── tsconfig.base.json
```

---

## 3. Quickstart & Local Development

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- Docker & Docker Compose (optional for local database & redis)

### Setup Instructions
```bash
# 1. Install dependencies
npm install

# 2. Generate Prisma Client & Build Packages
npx prisma generate
npm run build:packages

# 3. Start local Docker infrastructure (PostgreSQL with PostGIS + Redis)
npm run docker:up

# 4. Start Development Servers
npm run dev:api    # Starts NestJS API on http://localhost:4000/api/v1
npm run dev:web    # Starts Next.js Web on http://localhost:3000
```

---

## 4. Verification & Testing Commands
```bash
# Validate Prisma schema
npm run prisma:validate

# Run linter
npm run lint

# TypeScript Typecheck
npm run typecheck

# Run test suites
npm run test

# Build production bundles
npm run build
```
