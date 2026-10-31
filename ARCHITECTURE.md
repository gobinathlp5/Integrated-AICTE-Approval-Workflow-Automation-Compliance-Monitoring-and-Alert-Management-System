# System Architecture & Technical Specifications

**Project:** AICTE Security Deposit & FDR Management Portal  
**Problem Statement ID:** 26265  
**Problem Statement Title:** Streamline of Security Deposit/FDR Portal  
**Organization:** All India Council for Technical Education (AICTE), Department: Approval & Financial Regulation Bureau  
**Theme:** Smart Automation / Financial Governance  

---

## 1. High-Level Architecture Overview

```
                                  ┌──────────────────────────────────────────────┐
                                  │       Client Layer (Vite + React SPA)        │
                                  │ AICTE Security Deposit & FDR Portal (26265)  │
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
│  Auth & Identity Engine      │          │   FDR Relational Lifecycle   │          │  Document & File Vault       │
│  - Fail-Secure Secret Engine │          │   - Registration & Custody   │          │  - Magic Byte Validation     │
│  - Dynamic Bcrypt Salted OTP │          │   - 2-Party Verification     │          │  - Path Traversal Defense    │
│  - 13 RBAC Personas          │          │   - Discrepancy Adjudication │          │  - HMAC Time-Limited Tokens  │
│  - Multi-Tenant Isolation    │          │   - Renewals & Releases      │          │  - Watermarked Inline Stream │
└──────────────┬───────────────┘          └──────────────┬───────────────┘          └──────────────┬───────────────┘
               │                                         │                                         │
               └─────────────────────────────────────────┼─────────────────────────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │       Background Automation Daemon           │
                                  │   (Maturity Scan: 30d / 15d / Overdue Alerts) │
                                  └──────────────────────┬───────────────────────┘
                                                         │
                                                         ▼
                                  ┌──────────────────────────────────────────────┐
                                  │       Data Persistence & Audit Chain         │
                                  │   SQLite WAL Mode + Immutable Triggers       │
                                  │   SHA-256 Merkle-Style Cryptographic Ledger  │
                                  │   Versioned Schema Migrations (v1 - v11)     │
                                  └──────────────────────────────────────────────┘
```

---

## 2. Relational Database Schema (Version 11 Migration)

The system introduces 8 dedicated relational tables in `backend/src/db.js`:

1. **`fdr_records`**:
   - Master entity for every security deposit or bank guarantee.
   - Key fields: `fdr_number` (UNIQUE), `institution_id`, `deposit_amount`, `currency`, `issue_date`, `maturity_date`, `issuing_bank`, `bank_branch`, `ifsc_code`, `joint_holder_name`, `beneficiary`, `lien_marked`, `purpose`, `status`, `verification_status`.

2. **`fdr_documents`**:
   - Physical document attachments (scans, bank confirmation letters, joint mandates).
   - Key fields: `fdr_id`, `institution_id`, `document_type`, `stored_path`, `file_size`, `file_hash_sha256`, `verification_status`.

3. **`fdr_verifications`**:
   - Formal officer verification audit trail.
   - Key fields: `fdr_id`, `officer_id`, `officer_name`, `verification_method`, `bank_confirmation_ref`, `result`, `observations`.

4. **`fdr_discrepancies`**:
   - Bi-directional defect tracking for non-compliant instruments.
   - Key fields: `fdr_id`, `institution_id`, `category`, `title`, `description`, `severity`, `status`, `institution_response`, `resolution_remarks`.

5. **`fdr_renewals`**:
   - Renewal and instrument replacement requests.
   - Key fields: `original_fdr_id`, `replacement_fdr_id`, `renewal_type` (`SAME_FDR_EXTENDED` vs `NEW_FDR_REPLACEMENT`), `status`, `reviewed_by_id`, `review_decision`.

6. **`fdr_release_requests`**:
   - Statutory refund and release workflow.
   - Key fields: `fdr_id`, `request_number`, `reason`, `status` (`REQUESTED`, `UNDER_SCRUTINY`, `CA_APPROVED`, `RELEASE_COMPLETED`), `decision`, `release_evidence_doc_id`.

7. **`fdr_reminder_rules`**:
   - Automated threshold rules (30-day notice, 15-day notice, 0-day overdue alert).

8. **`fdr_alerts_sent`**:
   - Deduplication ledger ensuring institutions and officers receive at most one reminder per calendar day.

---

## 3. Background Automation Daemon & Alert Engine

The background scheduler (`backend/src/scheduler.js`) runs periodically (15-minute intervals) and performs:
- **Overdue Matured FDRs:** Identifies active or pending deposits where `maturity_date < today`. Automatically transitions status to `MATURED` and dispatches high-priority notifications to Institution Admin and Regional Officer.
- **Approaching Maturity (≤ 30 days & ≤ 15 days):** Identifies active deposits nearing maturity. Transitions status to `MATURING_SOON` and triggers proactive renewal reminders.
- **Alert Deduplication:** Checks `fdr_alerts_sent` by `date(sent_at) = date('now')` to ensure no spamming or alert fatigue occurs.

---

## 4. Multi-Tenant Isolation & Role-Based Access Control

1. **Institutional Tier (`INSTITUTION_ADMIN`, `INSTITUTION_STAFF`):**
   - Strictly isolated to `fdr.institution_id === req.user.institution_id`.
   - Cannot view or query deposits belonging to other institutions (`HTTP 403`).
   - Authorized to register new FDRs, upload documents, respond to discrepancies, and file renewal/release requests.

2. **Council Officer Tier (`REGIONAL_OFFICER`, `BUREAU_OFFICER`, `AICTE_ADMIN`, `SUPER_ADMIN`):**
   - Regional Officers are geographically scoped to their assigned administrative region (`i.region === req.user.region`).
   - Authorized to access the Verification Workspace, record bank confirmation outcomes, raise discrepancies, resolve discrepancies, and review renewal requests.

3. **Competent Authority Tier (`COMPETENT_AUTHORITY`):**
   - Exclusive statutory authority to review technical scrutiny recommendations and formally issue statutory Release & Refund Orders.

4. **Auditor Tier (`AUDITOR`):**
   - Strictly read-only access to FDR registers, verifications, discrepancies, and SHA-256 audit trails. All mutation actions are rejected.

---

## 5. Security Vault & Tamper-Evident Integrity

- **Cryptographic Audit Chain:** Every action (registering, modifying, uploading, verifying, raising discrepancy, resolving, renewing, releasing) appends a tamper-evident record to `document_audit_trail` linked by SHA-256 cryptographic chain.
- **Immutability Database Triggers:** SQLite triggers `prevent_audit_update` and `prevent_audit_delete` guarantee that records cannot be altered or removed after creation.
- **HMAC-SHA256 Token Vault:** Physical files are stored outside web-accessible roots. All previews and downloads require authenticated session tokens or temporary HMAC-SHA256 signed access tokens with a 5-minute validity window.
