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
│  - JWT + Cryptographic OTP   │          │   - 10-Stage Statutory Flow  │          │  - Magic Byte Validation     │
│  - Dynamic Bcrypt Salted OTP │          │   - Role Guardrails          │          │  - Path Traversal Defense    │
│  - RBAC & ABAC Enforcer      │          │   - Deficiency Management    │          │  - HMAC Time-Limited Tokens  │
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
                                  └──────────────────────────────────────────────┘
```

---

## 2. Multi-Tenant Isolation & ABAC Model

Access control is enforced at three distinct hierarchical boundaries:

1. **Role-Based Access Control (RBAC):**
   - 13 distinct roles across Institutional, Regional, Bureau, Scrutiny, Expert Committee, Appellate, and Auditing tiers.
   - Dynamic user-level permission overrides table (`user_permissions`).

2. **Tenant-Level Isolation (Multi-Tenancy):**
   - Every institutional record (`applications`, `documents`, `undertakings`, `compliance_records`) strictly carries `institution_id`.
   - The security middleware inspects authenticated `req.user.institution_id`. Any request by an institutional user for another institution's resource is rejected with `HTTP 403 Forbidden`.

3. **Assignment-Based Attribute Control (ABAC):**
   - Scrutiny Officers can only evaluate applications assigned to their evaluation docket (`assigned_evaluator_id`).
   - EVC Committee Members can only view inspection files and submit reports for applications where their committee is assigned (`evc_committee_members`).
   - Unassigned committee members attempting access receive `HTTP 403 Assignment Violation`.

---

## 3. Cryptographic MFA & Account Recovery Lifecycle

Universal codes (such as `123456`) are completely prohibited in the authentication kernel:

```
[User Login (Email + Password)]
               │
               ▼ (Valid Credentials)
    Does user have MFA active?
         /           \
       YES            NO
        │              │
        │              ▼
        │     [Issue Final Access Token]
        ▼
[Generate 6-Digit Cryptographic OTP]
[Salt & Hash with Bcrypt in users.mfa_temp_code]
[Set 5-Minute Expiry (mfa_code_expires_at)]
[Dispatch OTP via Secure Channel]
        │
        ▼
[User Submits OTP] ── (Max 3 Attempts) ──► Lockout on 3 Failures
        │
        ▼ (Valid Bcrypt Match)
[Issue Final Authenticated Session Token]
```

---

## 4. Statutory Approval State Machine

The approval lifecycle enforces deterministic, non-arbitrary stage transitions:

1. **DRAFT:** Application created and edited by verified applicant.
2. **SUBMITTED:** Formally locked and submitted to AICTE Regional Directorate.
3. **UNDER_SCRUTINY:** Assigned to Scrutiny Evaluator; statutory document verification and deficiency logging.
4. **DEFICIENCY_COMMUNICATED:** Deficiencies issued; applicant has statutory response window.
5. **EVC_SCHEDULED:** Expert Visiting Committee appointed; on-site/hybrid inspection scheduled.
6. **EVC_CONDUCTED:** Inspection completed; committee recommendations filed.
7. **SAC_HEARING:** Standing Appellate Committee hearing (if deficiencies contested or appealed).
8. **PENDING_COUNCIL_DECISION:** Submitted to Competent Authority for statutory decision.
9. **APPROVED / REJECTED:** Formal order issued with official order number, validity duration, and approved intake.

---

## 5. Tamper-Evident SHA-256 Audit Ledger

Every document operation (upload, view, download, classification change, verification) generates an immutable ledger entry.

$$H_i = \text{SHA-256}(H_{i-1} \parallel \text{audit\_id} \parallel \text{action} \parallel \text{user\_id} \parallel \text{timestamp})$$

- **Immutability:** SQLite database triggers `trg_prevent_audit_update` and `trg_prevent_audit_delete` raise `ABORT` on any update or delete attempts.
- **Verification:** Built-in cryptographic hash verification iterates the full ledger to ensure no records have been altered, injected, or removed out-of-order.

---

## 6. Automated SLA & Escalation Engine

The background scheduler (`backend/src/scheduler.js`) runs continuously to monitor statutory deadlines:

| Statutory Trigger | Threshold | Escalation Level | Notification Recipient |
|---|---|---|---|
| Scrutiny Phase Inactivity | > 14 Days | `LEVEL_1` | Regional Officer & Scrutiny Evaluator |
| EVC Inspection Pending | > 21 Days | `LEVEL_2` | Regulation Bureau Officer & EVC Coordinator |
| Statutory Undertaking Expiry | < 30 Days | `LEVEL_1` | Institution Admin & Bureau Officer |
| Annual Compliance Obligation | < 15 Days | `LEVEL_2` | Institution Admin & Bureau Officer |
