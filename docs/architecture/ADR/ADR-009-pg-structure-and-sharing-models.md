# ADR-009: PG Structure and Sharing Models

## Status
Accepted

## Context
In **CORE-005 (PG Structure — Floors, Rooms, Beds & Sharing Model)**, we need to represent multi-tenant, co-living structure hierarchies (Property → Floors → Rooms → Beds). The system must allow room-level sharing configurations (Single, Double, Triple, Four Sharing, Dormitory) while enforcing strict capacity limits, concurrent-safe bed allocations, state-machine transitions, and occupied deletion protections.

## Decisions

1. **Relational PG Hierarchy Design**:
   - `Floor` belongs to `Property`.
   - `Room` belongs to both `Property` and `Floor` for direct indexing, optimizing room searches by property.
   - `Bed` belongs to `Room`.

2. **Soft-Delete Lifecycle**:
   - Enforce soft-deletion on Floor, Room, and Bed entities using a nullable `deletedAt` field to preserve stay history.
   - Physical deletion is blocked at the database level using Prisma.

3. **Room Sharing Capacity Constraints**:
   - Room capacities are bound to sharing types:
     - `SINGLE`: 1 bed
     - `DOUBLE`: 2 beds
     - `TRIPLE`: 3 beds
     - `FOUR_SHARING`: 4 beds
     - `DORMITORY`: 6 beds (customizable)
   - Auto-generated beds match this capacity limit dynamically using suffix codes (e.g. `101-A`, `101-B`).
   - Manual bed additions are validated to prevent exceeding the room capacity.

4. **Occupied Resource Deletion Safeguards**:
   - Beds with `status === OCCUPIED` cannot be soft-deleted.
   - Rooms with active/occupied beds cannot be deleted.
   - Floors containing occupied rooms cannot be deleted.

5. **Explicit Bed Status Transitions**:
   - A finite state machine validates bed transitions. For example, moving an occupied bed directly to maintenance is blocked; it must be checked out first.

6. **Audit Logging & Security Controls**:
   - Standard audit logs must trace all modifications to PG structure resources.
   - Strict 5-step scoped checks block operations on non-PG properties.

## Consequences
- Restricts shared bed inventory logic strictly to PG properties, maintaining separation from whole-unit rental operations.
- Guarantees high operational reliability, preventing inventory over-allocation or accidental deletion of occupied rooms.
- Preserves complete stay history for future analytical and invoicing tasks.
