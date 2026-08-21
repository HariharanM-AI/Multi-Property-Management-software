# ADR-006: Property Domain, Dual Operating Models & Concurrency-Safe Sequence Codes

## Status
Accepted

## Context
PropertyOS serves both PG/Co-living facilities (inventory structured around shared rooms, beds, meals, and per-tenant splits) and Whole-Unit Rental properties (inventory structured around flat/villa units, leases, and security deposits).

Additionally, business operations require clean human-readable reference identifiers (e.g. `PROP-000001`) that are safe to display publicly, deterministic, scoped per organization, and resistant to race conditions under concurrent creation requests.

## Decisions

1. **Unified Property Model with Immutable Operating Model**:
   - Instead of splitting into distinct `PGProperty` and `RentalProperty` tables, use a single `Property` model with `propertyType: PG | RENTAL_HOUSE`.
   - The operating model is **immutable** upon creation to preserve relational integrity with downstream room/unit inventories.
2. **Model Capability System**:
   - Rather than scattering conditional statements throughout UI code, capabilities are resolved centrally via `PROPERTY_CAPABILITIES_CONFIG` and `hasPropertyCapability()`.
3. **Concurrency-Safe Sequence Generation**:
   - Do not use non-atomic `COUNT(*) + 1`.
   - Use an atomic PostgreSQL counter model (`OrganizationSequence`) inside interactive transactions (`$transaction`) with `@@unique([organizationId, code])`.
4. **Soft-Delete Archive Semantics**:
   - Normal property operations do not physically delete database rows.
   - `POST /properties/:id/archive` soft-deletes via `status = ARCHIVED` and `deletedAt = timestamp`, authorized by `property.delete`.
   - `POST /properties/:id/restore` restores the property to `ACTIVE`.
5. **Storage Abstraction Service**:
   - All property media operations route through `StorageService` interface backed by `LocalStorageDriver` in development, with future GCS adapter compatibility.

## Consequences
### Positive
- Zero risk of duplicate property codes under high concurrency.
- Clean domain segregation between PG and Rental operations without redundant tables.
- Full auditability with soft-deletion and restoration.
- Storage layer remains swappable without modifying domain business logic.
