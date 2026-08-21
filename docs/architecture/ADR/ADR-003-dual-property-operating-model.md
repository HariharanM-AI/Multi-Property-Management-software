# ADR-003: Dual Property Operating Model (PG / Co-Living vs Whole-Unit Rental)

## Status
Accepted

## Context
Property owners manage two distinct property categories:
1. **PG / Co-Living / Hostel**: Bed-level booking, floor/room hierarchy, room sharing, meal subscriptions, sub-metered electricity splitting.
2. **Whole-Unit Rental**: Flat/house/villa-level booking, household lease agreements, security deposit refunds, periodic rent escalations.

Creating two separate standalone applications would cause massive code duplication, whereas treating them identically would result in confusing user experiences (e.g. asking for bed numbers on a 3BHK flat).

## Decision
Implement a **polymorphic domain hierarchy** under a unified platform:
- Every property has a `property_type` enum (`PG` or `RENTAL_HOUSE`).
- The backend dynamically gates module endpoints based on `property_type` (e.g., meal endpoints reject requests for `RENTAL_HOUSE` properties).
- The frontend dynamically adapts navigation, forms, and metrics based on the active property context without code duplication.

## Consequences
### Positive
- Unified authentication, billing engine, maintenance, and expense tracking across all properties.
- Context-sensitive UX that feels tailored for both PG operators and residential landlords.
