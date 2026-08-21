# ADR-004: Authentication & Session Management Architecture

## Status
Accepted

## Context
Storing JWTs or tokens in `localStorage` exposes user sessions to Cross-Site Scripting (XSS) attacks. Weak password hashing (e.g., standard SHA-256 or MD5) is vulnerable to GPU-based rainbow table and brute-force cracking.

## Decision
- Use **Argon2id** (memory-hard, resistant to GPU and side-channel attacks) for password hashing.
- Manage sessions using **HTTP-only, SameSite=Lax, Secure cookies**.
- Never store access or refresh tokens in `localStorage` or `sessionStorage`.
- Enforce brute-force rate limiting on authentication endpoints (5 attempts per 15 minutes per IP).

## Consequences
### Positive
- Immunity to token theft via JavaScript/XSS.
- Protection against credential-stuffing and offline dictionary attacks.
- Seamless authentication propagation across server components and API requests.
