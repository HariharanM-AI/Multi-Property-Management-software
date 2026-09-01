# PropertyOS — Digital Personal Data Protection (DPDP) Act (India) Compliance Progress & Matrix

**Document Reference**: DPDP-2023-COMPLIANCE-MATRIX  
**Regulatory Framework**: Digital Personal Data Protection Act, 2023 (India)  
**Applicability Scope**: PropertyOS Enterprise Operator & Owner Platform (Phase 1)  
**Status**: ACTIVE COMPLIANCE ENGINEERING IMPLEMENTATION  
**Last Audited**: August 2026  
**Disclaimer**: *LEGAL REVIEW REQUIRED — This matrix reflects technical architecture and controls implemented in PropertyOS to support compliance with the DPDP Act 2023. Final legal review by qualified Indian legal counsel is required prior to production deployment.*

---

## 1. Executive Summary

PropertyOS is an enterprise property management and operations platform designed for property owners, operators, PG managers, and residential property management enterprises in India. The platform collects, stores, and processes personal data of Data Principals (tenants, occupants, prospective residents, staff members, maintenance technicians, and visitors) on behalf of Data Fiduciaries (property owners and operating organizations).

Under the **Digital Personal Data Protection Act, 2023 (DPDP Act)**, PropertyOS implements technical and organizational safeguards across the entire data lifecycle:
1. **Notice & Consent (Sections 5 & 6)**: Clear, accessible privacy notices and purpose-limited collection.
2. **Legitimate Uses (Section 7)**: Processing strictly necessary for executing tenancy contracts, verifying identity, statutory record-keeping, and billing.
3. **Data Principal Rights (Sections 11–14)**: Right to Access, Right to Correction/Erasure, Right of Grievance Redressal, and Right to Nominate.
4. **Data Security & Breach Response (Section 8)**: Append-only audit logging, encryption, role-based access control (RBAC), and a 72-hour breach reporting runbook (`BREACH_RUNBOOK.md`).

---

## 2. Personal Data Inventory & Classification Matrix

| Data Category | Data Elements | Data Principal | Lawful Ground / Purpose | Storage & Retention | Security Controls |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Occupant Identity & KYC** | Full Name, Phone, Email, Govt ID Type, Masked ID Number, ID Document URI | Tenants, Co-residents | Contractual performance (Tenancy Agreement), KYC statutory compliance | Retained during active stay + 7 years post-checkout (tax/statutory) | AES-256 encrypted at rest, RBAC restricted to Owners/Managers |
| **Emergency Contacts** | Contact Name, Relationship, Phone Number | Emergency Contact of Occupant | Vital interest / safety and emergency response | Retained during active stay | Masked in standard views, accessible only to authorized staff |
| **Financial & Billing Data** | Bank Account Name, UPI ID, Rent Invoices, Payment Transaction IDs, Ledger Entries | Tenants, Property Owners | Performance of contract, accounting, statutory GST & tax compliance | 8 years as required under Indian Income Tax Act / Companies Act | Immutable ledger, RBAC isolated by Organization ID |
| **Stay & Occupancy History** | Room/Bed ID, Check-in Date, Check-out Date, Move-in Condition Reports | Occupants | Tenancy management and property operations | Retained for audit & tenancy dispute resolution (3 years) | Tenant isolation, cryptographically hashed audit trails |
| **Staff & Personnel Records** | Staff Name, Phone, Role, Shift Timing, Emergency Contact | Employees, Security, Housekeeping | Employment administration and facility operations | Retained during employment + 3 years | RBAC role separation, hashed passwords (bcrypt 12 rounds) |
| **Visitor Records** | Visitor Name, Phone, Purpose of Visit, Check-in/Out Timestamp | Visitors / Guests | Premises security and physical safety | Auto-archived after 90 days unless flagged for incident | Minimal collection, auto-purging policy |
| **Audit & Security Logs** | User ID, IP Address, User Agent, Action, Resource, Timestamp, Differential State | Platform Users (Staff, Owners) | Security monitoring, tamper detection, statutory compliance | Append-only immutable log; 3 years retention | Cryptographic hash chaining, zero update/delete permissions |

---

## 3. DPDP Act Core Principles Compliance Status

| Principle / Section | Requirement | PropertyOS Technical Implementation | Status |
| :--- | :--- | :--- | :--- |
| **Section 4 & 5: Notice & Purpose** | Provide itemized notice before or at time of data collection specifying data collected and purpose | Comprehensive Privacy Notice page deployed at `/privacy`; onboarding modal displays itemized purpose notice for KYC collection | **COMPLIANT** |
| **Section 6: Consent Management** | Consent must be free, specific, informed, unconditional, and unambiguous | Clear affirmative consent captured during tenant onboarding; consent state logged in database with timestamp | **COMPLIANT** |
| **Section 7: Legitimate Uses** | Processing for fulfilling employment, statutory obligations, contract execution, or voluntary provision | System enforces purpose binding: data collected for KYC is not repurposed for secondary marketing or third parties | **COMPLIANT** |
| **Section 8(1): Data Accuracy** | Ensure personal data is accurate, complete, and consistent | Tenant profile updating endpoints; owner verification workflows for KYC records | **COMPLIANT** |
| **Section 8(5): Reasonable Security Safeguards** | Implement reasonable security safeguards to prevent personal data breach | Multi-tenant tenant ID isolation, bcrypt password hashing, JWT stateless authentication, strict RBAC, immutable audit logging | **COMPLIANT** |
| **Section 8(6): Breach Notification** | Obligation to notify Data Protection Board and affected Data Principals in event of breach | Established operational protocol documented in `BREACH_RUNBOOK.md` with 72-hour notification timeline | **COMPLIANT** |
| **Section 8(7): Data Erasure & Retention** | Erase personal data when purpose is served and retention is no longer necessary | Data rights erasure request pipeline (`/privacy/data-rights`); automatic retention policy classification | **COMPLIANT** |
| **Section 9: Children's Data** | Obtain verifiable parental consent before processing child data; avoid harmful tracking | PropertyOS terms explicitly require adults (18+) for primary tenancy contracting; guardian consent required for student PGs | **COMPLIANT** |
| **Section 11: Right to Access** | Data Principal right to obtain summary of personal data and processing activities | Data rights portal at `/privacy/data-rights` enables request for personal data summary export | **COMPLIANT** |
| **Section 12: Right to Correction & Erasure** | Right to correct, complete, update, and erase personal data | Profile update workflows and self-service correction request ticketing | **COMPLIANT** |
| **Section 13: Right of Grievance Redressal** | Readily available grievance redressal mechanism with designated Grievance Officer | Published Grievance Officer contact details and structured ticket resolution process under `/privacy` | **COMPLIANT** |
| **Section 14: Right to Nominate** | Right of Data Principal to nominate representative in event of death or incapacity | Emergency contact and nominee identification fields in tenant onboarding and agreement modules | **COMPLIANT** |

---

## 4. Multi-Employee Role-Based Access Control (RBAC) Matrix

| User Role | Tenant Data | Financial Records | KYC Documents | Staff & Roster | Audit Logs | System Settings |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **OWNER / SUPER_ADMIN** | Full CRUD | Full Access | Full Access | Full Access | Full Access & Export | Full Access |
| **PROPERTY_MANAGER** | View / Update | View / Invoice | View / Verify | View / Assign | View Filtered | View Only |
| **WARDEN (PG)** | View / Check-In | View Meal/Bed | View Basic | View Roster | No Access | No Access |
| **ACCOUNTANT** | View Limited | Full Financials | No Access | No Access | Finance Logs | No Access |
| **MAINTENANCE_STAFF** | No Access | No Access | No Access | View Assigned | No Access | No Access |
| **SECURITY_GUARD** | Visitor Only | No Access | No Access | Shift Only | No Access | No Access |

---

## 5. Grievance Redressal Architecture

- **Designated Grievance Officer**: Operations & Data Protection Lead (`privacy@propertyos.internal` / Organization Admin)
- **Response Timeline**: Acknowledgment within 24 hours; resolution within 15 business days (standard Indian regulatory window).
- **Escalation Path**: If unresolved, Data Principals may submit complaints directly to the Data Protection Board of India (DPBI).
- **Portal Access**: Directly accessible at `/privacy` and `/privacy/data-rights`.

---

## 6. Action Items & Verification Checklist

- [x] Create comprehensive `DPDP_PROGRESS.md` compliance matrix.
- [x] Create operational incident response runbook `BREACH_RUNBOOK.md`.
- [x] Build user-facing Privacy Notice at `/privacy`.
- [x] Build interactive Data Rights Request Portal at `/privacy/data-rights`.
- [x] Build Terms of Service with DPDP & data protection clauses at `/terms`.
- [x] Add consent banner component for privacy compliance.
- [x] Verify multi-tenant database isolation and append-only audit trails.
- [x] Conduct automated boundary and E2E verification.
