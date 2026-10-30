# System Architecture & Technical Specifications

**Project:** Integrated AICTE Approval Workflow Automation, Compliance Monitoring and Alert Management System  
**Problem Statement ID:** 26262  
**Organization:** All India Council for Technical Education (AICTE), Department: Regulation Bureau  
**Theme:** Smart Automation  

---

## 1. High-Level Architecture Overview

```
                                  ┌──────────────────────────────────────────────┐
                                  │      Client Layer (Vite + React SPA)         │
                                  │      AICTE Digital Governance Portal         │
                                  └──────────────────────┬───────────────────────┘
                                                         │ HTTPS / JSON / Multipart
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │       API Gateway & Security Kernel          │
                                  │ (Express.js, Helmet, CORS, Rate Limiters)    │
                                  └──────────────────────┬───────────────────────┘
                                                         │
               ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
               ▼                                         ▼                                         ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐          ┌──────────────────────────────┐
│  Auth & Identity Engine      │          │   Workflow & State Machine   │          │  Document & File Vault       │
│  - Fail-Secure Secret Engine │          │   - 12-Stage Enforced Graph  │          │  - Magic Byte Validation     │
│  - Dynamic Bcrypt Salted OTP │          │   - Optimistic Concurrency   │          │  - Path Traversal Defense    │
│  - RBAC & ABAC Enforcer      │          │   - Prerequisite Kernel      │          │  - HMAC Time-Limited Tokens  │
└──────────────┬───────────────┘          └──────────────┬───────────────┘          └──────────────┬───────────────┘
               │                                         │                                         │
               └─────────────────────────────────────────┼─────────────────────────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │        Background Automation Daemon          │
                                  │        (Cron SLA & Escalation Engine)        │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │       Data Persistence & Audit Chain         │
                                  │   SQLite WAL Mode + Immutable Triggers       │
                                  │   SHA-256 Merkle-Style Cryptographic Ledger  │
                                  │   Atomic Deterministic Order Sequences       │
                                  └──────────────────────────────────────────────┘
```

---

## 2. Multi-Tenant Isolation & Scope Boundaries

Access control is enforced at three distinct hierarchical boundaries:

1. **Role-Based Access Control (RBAC):**
   - 13 distinct roles across Institutional, Regional, Bureau, Scrutiny, Expert Committee, Appellate, and Auditing tiers.
   - Dynamic user-level permission overrides table (`user_permissions`).

2. **Tenant-Level Isolation (Multi-Tenancy):**
   - Every institutional record (`applications`, `documents`, `undertakings`, `compliance_records`) strictly carries `institution_id`.
   - The security middleware inspects authenticated `req.user.institution_id`. Any request by an institutional user for another institution's resource (including workflow history and decision dockets) is rejected with `HTTP 403 Forbidden`.

3. **Regional Directorate Jurisdiction & Assignment-Based Attribute Control (ABAC):**
   - Regional Officers are constrained strictly to applications and decisions within their assigned administrative region (`req.user.region`).
   - Scrutiny Officers can only evaluate applications assigned to their evaluation docket (`assigned_scrutiny_officer_id`).
   - EVC Committee Members can only view inspection files and submit reports for applications where their committee is assigned (`evc_committee_members`).
   - CAG Statutory Auditors are strictly read-only and prohibited from executing mutations or workflow transitions.

---

## 3. Workflow State Machine & Concurrency Safeguards

The workflow transition engine (`backend/src/routes/workflowRoutes.js`) enforces:

1. **Strict Transition Graph:** Only transitions defined in `VALID_TRANSITIONS` are permitted. Stage skipping (e.g. from `SUBMITTED` directly to `APPROVED`) is rejected with `HTTP 409 Conflict`.
2. **Role Authorization Matrix:** Each target stage requires specific statutory authority. Final `APPROVED` and `REJECTED` states can only be executed by `COMPETENT_AUTHORITY`.
3. **Optimistic Locking / Race Condition Prevention:** All stage transitions update atomically:
   ```sql
   UPDATE applications 
   SET current_stage = ?, status = ?, updated_at = CURRENT_TIMESTAMP
   WHERE id = ? AND (current_stage = ? OR (current_stage IS NULL AND status = ?))
   ```
   If zero rows are modified due to a concurrent transition, the engine rejects with `HTTP 409 Conflict`.
4. **Authorized Workflow History:** Access to workflow history is gated by institution match for applicants and regional/assignment checks for officers.

---

## 4. Decision Engine & Centralized Prerequisites

The decision pipeline (`backend/src/routes/decisionRoutes.js`) enforces:

1. **Role-Restricted Pending Docket:** Only authorized decision-making roles (`COMPETENT_AUTHORITY`, `REGULATION_BUREAU`, `BUREAU_OFFICER`, `REGIONAL_OFFICER`, `SUPER_ADMIN`) can access pending decision lists, with regional filtering applied.
2. **Centralized Prerequisite Validation (`validateDecisionPrerequisites`):**
   - Application stage eligibility (must have completed scrutiny).
   - Duplicate decision prohibition (preventing re-deciding an already approved/rejected docket).
   - Zero unresolved critical or major deficiencies.
   - Verification of all uploaded statutory documents.
   - Formal scrutiny and SAC recommendation checks.
3. **Strict Decision Enums:** Permitted values restricted to `['APPROVED', 'REJECTED', 'RETURNED_WITH_CONDITIONS', 'REJECTED_WITH_APPEAL']`.
4. **No Unsafe Default Values:** Mandates explicit `approvedIntake` (> 0) and `validityYears` (1–5) for approvals; mandates formal statutory `reasoning` for rejections.
5. **Deterministic Order Number Allocation:** Atomic database sequences (`order_number_sequences`) generate sequential, collision-free order numbers formatted as `AICTE/ORDER/${YYYY}/${NNNNNN}`.

---

## 5. Fail-Secure Authentication & Cryptographic Keys

1. **Mandatory Cryptographic Secrets:** Both `JWT_SECRET` and `DOC_TOKEN_SECRET` are required in all environments and must satisfy a minimum length of 32 characters. The service fails securely at startup if either key is missing or weak.
2. **Dynamic Salted OTPs:** 6-digit cryptographic OTPs are salted with bcrypt, bounded by a 5-minute TTL, and protected by a 3-attempt lockout.
3. **Environment Security:** All `.env` files are excluded via `.gitignore`, while `.env.example` provides safe placeholder documentation.

---

## 6. Tamper-Evident SHA-256 Audit Ledger

Every document operation (upload, view, download, classification change, verification) generates an immutable ledger entry.

$$H_i = \text{SHA-256}(H_{i-1} \parallel \text{audit\_id} \parallel \text{action} \parallel \text{user\_id} \parallel \text{timestamp})$$

- **Immutability:** SQLite database triggers `trg_prevent_audit_update` and `trg_prevent_audit_delete` raise `ABORT` on any update or delete attempts.
- **Verification:** Built-in cryptographic hash verification iterates the full ledger to ensure no records have been altered, injected, or removed out-of-order.
