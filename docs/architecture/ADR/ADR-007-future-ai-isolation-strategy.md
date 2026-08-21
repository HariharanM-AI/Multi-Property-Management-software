# ADR-007: Future AI Isolation & Phase 1 Non-AI Boundary

## Status
Accepted

## Context
Advanced AI capabilities (e.g. intelligent vacancy matching, rent recommendation, automated ticket triage) will be added in subsequent phases. Introducing AI prematurely before foundational operations and data models are hardened causes instability, nondeterminism, and unwarranted dependencies.

## Decision
- **Strict Phase 1 Isolation**: Zero AI / ML / LLM / Vector Search / pgvector modules or dependencies in Phase 1.
- Prepare data architecture for future consumption:
  1. Clean timestamps, foreign keys, and immutable audit logs.
  2. Read-only historical occupancy and payment ledger trails.
  3. Decoupled event emitter interfaces so future AI background consumers can hook into business events without modifying core domain logic.

## Consequences
### Positive
- Rock-solid deterministic business and financial operations.
- Clean architectural boundary for Phase 2+ extensions.
- Zero AI hallucinations or unexpected automated state mutations.
