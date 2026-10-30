# AICTE Centralized Authentication, RBAC, and Document Visibility Platform

## 1. Executive Summary

This platform implements a centralized authentication, role-based access management, and document visibility system for the **All India Council for Technical Education (AICTE)** portal. It provides backend-enforced security boundaries, multi-tenant isolation, multi-channel communication separation, time-limited cryptographic download authorization, and a tamper-evident SHA-256 hash-chained audit ledger.

---

## 2. Platform Architecture

```
                    +------------------------------------------+
                    |    Unified Centralized Login Gateway     |
                    |    (All 13 AICTE Roles + Institution)    |
                    +------------------------------------------+
                                         |
                       [JWT Session / Optional MFA TOTP]
                                         |
                                         v
         +---------------------------------------------------------------+
         |                Backend Kernel Policy Engine                   |
         |  - Tenant Isolation (Institution / Region / Assignment)       |
         |  - Fine-Grained RBAC & Dynamic User-Specific Overrides        |
         |  - Document Confidentiality Filter Engine                     |
         +---------------------------------------------------------------+
                  /                      |                      \
                 /                       |                       \
                v                        v                        v
    +-----------------------+ +---------------------+ +-----------------------+
    |  Document Repository  | | Multi-Channel Notes | |  Immutable Audit Log  |
    |  - Virtual Folders    | | - Inst-Visible      | |  - SHA-256 Hash Chain |
    |  - Version History    | | - Internal AICTE    | |  - SQLite Triggers    |
    |  - Expiry Monitoring  | | - EVC Observations  | |  - Anti-Tamper Guard  |
    |  - HMAC Signed URLs   | | - Competent Auth.   | |  - Complete Telemetry |
    +-----------------------+ +---------------------+ +-----------------------+
```

---

## 3. Supported User Roles (Section A)

The system supports all 13 specified user categories:

| S.No | User Role | System Role Identifier | Scope & Isolation Rules |
|------|-----------|------------------------|-------------------------|
| 1 | Super Administrator | `SUPER_ADMIN` | Full administrative & policy management across all AICTE operations. |
| 2 | AICTE Administrator | `AICTE_ADMIN` | Council-wide portal administration, RBAC & user provisioning. |
| 3 | Regulation Bureau Officer | `REGULATION_BUREAU` | Bureau-level regulation oversight and statutory rule enforcement. |
| 4 | Regional Officer | `REGIONAL_OFFICER` | Region-isolated management (e.g. Northern, Western, Southern). |
| 5 | Bureau Officer | `BUREAU_OFFICER` | Scrutiny and bureau dossier processing. |
| 6 | Scrutiny Officer | `SCRUTINY_OFFICER` | Assignment-isolated document review; can VERIFY or RETURN with remarks; **cannot modify original uploaded files**. |
| 7 | EVC Coordinator | `EVC_COORDINATOR` | Regional inspection committee oversight and assignment. |
| 8 | EVC Committee Member | `EVC_MEMBER` | Committee assignment-isolated access; restricted to appointed committee dossiers. |
| 9 | SAC/SHC Member | `SAC_SHC_MEMBER` | Standing Appellate Committee judicial review. |
| 10 | Competent Authority | `COMPETENT_AUTHORITY` | Member Secretary / Chairman; exclusive statutory **APPROVE / REJECT** power. |
| 11 | Institution Administrator | `INSTITUTION_ADMIN` | Principal / Director; tenant-isolated to own institution ID. |
| 12 | Institution Staff | `INSTITUTION_STAFF` | Authorized representative; tenant-isolated to own institution ID. |
| 13 | Auditor / Read-Only User | `AUDITOR` | CAG / Statutory compliance officer; **strictly read-only access across all records**; mutation forbidden. |

---

## 4. Security & Privilege Escalation Defenses

### Public Registration Isolation
Public self-registration via `/api/auth/register` strictly accepts only `INSTITUTION_ADMIN` and `INSTITUTION_STAFF`. Any attempt by an external actor to register as a privileged AICTE role (`SUPER_ADMIN`, `SCRUTINY_OFFICER`, `REGIONAL_OFFICER`, etc.) is blocked with **HTTP 403 Forbidden**. Official AICTE accounts must be provisioned by the AICTE Administrator.

### Account Lockout & Failed-Login Protection
If 5 consecutive failed login attempts occur on any account, the system automatically locks the account for 15 minutes (`locked_until`). All login attempts (success, bad credentials, lockout, MFA status) are recorded in `login_history` with IP address and User Agent.

### Optional Multi-Factor Authentication (MFA)
Users can enable optional 2FA. When enabled, login issues a temporary MFA challenge session requiring a 6-digit verification code (`123456`) before the JWT authorization token is minted.

---

## 5. Granular RBAC & Data Isolation (Section B)

### Core System Permissions
1. `VIEW`
2. `CREATE`
3. `EDIT`
4. `UPLOAD`
5. `DOWNLOAD`
6. `DELETE` (where legally permitted)
7. `VERIFY`
8. `RETURN`
9. `ASSIGN`
10. `REASSIGN`
11. `APPROVE_REJECT` (restricted exclusively to Competent Authority)
12. `EXPORT`
13. `CONFIGURE`

### Multi-Level Isolation Hierarchy
- **Institution-Level Isolation:** Institution A (`inst_delhi_001`) cannot access Institution B (`inst_mumbai_002`) documents or applications. Enforced at SQL query level and API middleware.
- **Region-Level Isolation:** Regional Officers only receive applications and institutions within their assigned geographic zone.
- **Assignment-Level ABAC:** Scrutiny Officers and EVC Committee members only access applications and restricted committees explicitly assigned to them in the database.
- **User-Specific Overrides:** Administrators can explicitly GRANT or DENY individual permissions to specific users, overriding the role default.

---

## 6. Document-Level Visibility & Rules (Sections C & D)

Every document record carries independent access-control metadata:
- `institution_id`
- `application_id`
- `document_category` (LAND, BUILDING, FINANCIAL, FACULTY, AFFIDAVIT, UNDERTAKING, COMPLIANCE, RENEWAL, EVC_REPORT, SAC_REPORT, APPROVAL_LETTER)
- `folder_category` (INSTITUTION, APPLICATION, UNDERTAKING, COMPLIANCE, RENEWAL, COMMITTEE_INSPECTION)
- `uploader_id`, `uploader_name`, `uploader_role`, `upload_timestamp`
- `verification_status` (PENDING, VERIFIED, REJECTED, RETURNED_FOR_CORRECTION)
- `confidentiality_classification` (1. `INSTITUTION_VISIBLE`, 2. `INTERNAL_AICTE`, 3. `COMMITTEE_RESTRICTED`, 4. `HIGHLY_RESTRICTED`)
- `allowed_roles` / `allowed_users`
- `expiry_date` & computed monitoring status (ACTIVE, EXPIRING_SOON, EXPIRED)
- `document_version`
- `retention_status` (ACTIVE, HOLD, PURGE_PROTECTED)
- `checksum_sha256`

### Independent Document Actions
- `PREVIEW`: In-browser watermarked preview stream.
- `VIEW`: Metadata inspection.
- `DOWNLOAD`: Time-limited HMAC-SHA256 signed URL download.
- `UPLOAD`: Upload new statutory document.
- `REPLACE`: Uploads replacement version (v2, v3) while archiving original version in `document_versions`. Blocked for Scrutiny Officers and Auditors.
- `VERIFY`: Verification determination by authorized officers.
- `CHANGE_VISIBILITY`: Modifies confidentiality tag; creates immutable audit record.
- `DELETE`: Blocked if document is VERIFIED or on LEGAL HOLD / PURGE PROTECTED.

---

## 7. Multi-Channel Communication Isolation (Section E)

Separate communication channels are enforced:
1. `INSTITUTION_VISIBLE`: Shared between the submitting institution and AICTE officers.
2. `INTERNAL_AICTE`: Confidential deliberations between scrutiny officers and bureau heads. Completely hidden from institutions.
3. `COMMITTEE_RESTRICTED`: EVC inspection observations accessible only to empanelled inspectors.
4. `COMPETENT_AUTHORITY`: High-level appellate and policy remarks.

### Explicit Release Mechanism
Internal notes remain hidden from the institution portal unless an authorized AICTE officer triggers the **"Explicitly Release to Institution"** action (`/api/comments/:id/release`), which sets `is_released_to_institution = 1` with an audit record of who released it and when.

---

## 8. Tamper-Evident Immutable Audit Ledger (Section G)

- **Audit Trigger Guard:** SQLite triggers `prevent_audit_update` and `prevent_audit_delete` abort any `UPDATE` or `DELETE` on the `document_audit_trail` table.
- **Cryptographic Hash Chaining:** Every audit entry computes:
  $$\text{entry\_hash} = \text{SHA-256}(\text{previous\_hash} \parallel \text{audit\_id} \parallel \text{document\_id} \parallel \text{institution\_id} \parallel \text{action} \parallel \text{performed\_by\_id} \parallel \text{timestamp} \parallel \text{details})$$
- The chain starts from `0000...0000` (Genesis) and forms a verifiable merkle-style audit trail.
- `/api/audit/verify-integrity` re-evaluates the whole chain dynamically to confirm zero tampering.

---

## 9. Verification of Mandatory Security Tests (Section H & I)

Run the test suite with:
```bash
npm test
```

### Test Outcomes:
- `SEC-TEST-01`: Institution A cannot access Institution B's documents $\rightarrow$ **PASSED (HTTP 403)**
- `SEC-TEST-02`: An institution cannot access internal AICTE notes $\rightarrow$ **PASSED (HTTP 403)**
- `SEC-TEST-03`: Unassigned EVC member cannot access another committee's restricted documents $\rightarrow$ **PASSED (HTTP 403)**
- `SEC-TEST-04`: Scrutiny officer cannot modify institution original uploaded file $\rightarrow$ **PASSED (HTTP 403)**
- `SEC-TEST-05`: Auditor cannot modify records $\rightarrow$ **PASSED (Read-only Enforced)**
- `SEC-TEST-06`: Anti-IDOR direct URL parameter tampering test $\rightarrow$ **PASSED (HTTP 403)**
- `SEC-TEST-07`: Expired access links cannot be reused $\rightarrow$ **PASSED (HMAC Expiry Enforced)**
- `SEC-TEST-08`: Changing document visibility creates audit record $\rightarrow$ **PASSED (Audit Chain Intact)**
- `ACCEPTANCE-TEST-01`: End-to-end Section I lifecycle demonstration $\rightarrow$ **PASSED (100% Compliant)**
