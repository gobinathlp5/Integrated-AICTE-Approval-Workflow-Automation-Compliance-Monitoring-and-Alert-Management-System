# AICTE Security Deposit & FDR Management Portal

[![CI/CD Pipeline](https://github.com/gobinathlp5/Integrated-AICTE-Approval-Workflow-Automation-Compliance-Monitoring-and-Alert-Management-System/actions/workflows/ci.yml/badge.svg)](https://github.com/gobinathlp5/Integrated-AICTE-Approval-Workflow-Automation-Compliance-Monitoring-and-Alert-Management-System/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node: >=18.0.0](https://img.shields.io/badge/Node->=18.0.0-green.svg)](https://nodejs.org/)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite_WAL_Mode-informational.svg)](https://sqlite.org/)

**Problem Statement ID:** 26265  
**Problem Statement Title:** Streamline of Security Deposit/FDR Portal  
**Organization:** All India Council for Technical Education (AICTE)  
**Department:** Approval & Financial Regulation Bureau  
**Product Identity:** AICTE Security Deposit & FDR Management Portal  

---

## 🏛️ Executive Summary

The **AICTE Security Deposit & FDR Management Portal** is a production-grade, centralized, and intelligent enterprise platform engineered for the All India Council for Technical Education (AICTE) to streamline the complete administrative lifecycle of security deposits and Fixed Deposit Receipts (FDRs) associated with AICTE approval-related processes.

In accordance with the **AICTE Approval Process Handbook (APH)**, technical institutions across India deposit substantial statutory security deposits in joint names with the Regional Officer, AICTE, with exclusive lien marked in favor of the Member Secretary, AICTE.

This platform replaces fragmented, paper-based registers and manual tracking with a unified regulatory operating system featuring:
- **Statutory FDR Registry & Custody:** Complete centralized repository for all institutional security deposits, bank guarantees, and lien endorsements.
- **Officer Verification Workspace:** Two-party verification comparing uploaded receipts and bank lien letters, supporting automated bank APIs, confirmation letters, and official email exchanges.
- **Bi-directional Discrepancy Tracking:** Systematic raising of deficiencies (amount mismatch, missing joint mandate, invalid IFSC/bank), institution clarifications, and formal officer resolutions.
- **Automated Maturity Monitoring & Alert Engine:** Real-time scanning identifying deposits maturing in ≤30 days, ≤15 days, or overdue/matured instruments, triggering multi-tier email and dashboard notifications with daily deduplication.
- **Renewal & Replacement Workflows:** Structured pathways for same-FDR extensions or replacement by newly registered instruments with audit cross-linking.
- **Release & Refund Lifecycle:** Formal request submission upon completion of statutory tenure, technical officer scrutiny, Competent Authority approval, and lien revocation recording.
- **Tamper-Evident SHA-256 Audit Trail:** Cryptographic hash chaining on all document mutations and financial state transitions.
- **Multi-Tenant Isolation & RBAC:** Strict tenant boundaries across 13 administrative roles.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18.x or v20.x, tested on v24)
- npm (v9.x or higher)

### 2. Run Comprehensive Automated Test Suites
Execute all automated test suites covering security isolation, API contracts, statutory safeguards, and the full FDR lifecycle:
```bash
npm --prefix backend test
```
*Runs all 5 test suites (Security, API Contracts, Workflow Engine, Safeguards, and FDR Lifecycle) with 100% pass rate.*

### 3. Running the Complete Application

**Option A — Concurrent Execution (Recommended):**
```bash
npm start
```

**Option B — Independent Services:**

Backend API Service:
```bash
npm run start:backend
# API server listening on http://localhost:5000
```

Frontend Client Web App:
```bash
npm run start:frontend
# Client portal accessible at http://localhost:3000
```

---

## 👥 Personas & Pre-Configured Test Credentials

All pre-configured testing accounts share the standardized test password: `Password@123`

| Role Category | Username | Persona / Scope | Administrative Authority |
|---|---|---|---|
| **Super Administrator** | `superadmin` | Dr. T. G. Sitharam | Full Platform & System Governance |
| **AICTE Administrator** | `aicteadmin` | Shri Manoj Kumar | Portal Configuration & RBAC Management |
| **Regulation Bureau Officer** | `regbureau` | Prof. Rajive Kumar | Regulation Bureau Policy & Oversight |
| **Regional Officer** | `regionalofficer` | Dr. Sunil Luthra | Northern Regional Directorate Verification |
| **Bureau Officer** | `bureauofficer` | Smt. Vandana Sharma | National Approval Bureau Management |
| **Scrutiny Officer** | `scrutinyofficer` | Dr. R. K. Sharma | FDR Technical Scrutiny & Deficiency Issuance |
| **Competent Authority** | `competentauthority` | Appellate Authority | Final Statutory Release & Refund Order Signing |
| **Institution A Admin** | `instadmin` | Dr. Arvind Verma | Delhi Institute of Technology (Applicant) |
| **Institution A Staff** | `inststaff` | Sri Ramesh Narayan | Delhi Institute Submission Staff |
| **Institution B Admin** | `instadmin_b` | Dr. Suresh Patil | Mumbai College of Engineering (Tenant B) |
| **Statutory Auditor (CAG)** | `auditor` | Shri Alok Jain | Strict Read-Only Statutory Oversight & Auditing |

---

## 🏦 End-to-End FDR Lifecycle Architecture

```
                       [ Institution ]
                              │
                    (1) Register FDR Receipt
                              │
                    (2) Upload Scanned Copy & Lien Mandate
                              │
                    (3) Submit for Verification
                              ▼
                   [ Verification Workspace ]
                     (Council Officer Review)
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                           ▼
 [ Discrepancy Found ]                    [ Verified & Compliant ]
        │                                           │
  (4) Raise Discrepancy                     (5) Mark VERIFIED
  (Amount / Lien / IFSC)                            │
        │                                    [ Status: ACTIVE ]
  (4a) Inst. Clarification                          │
        │                                   (6) Background Scheduler
  (4b) Officer Resolution                   (Maturity Scan: 30d / 15d / 0d)
        │                                           │
        └─────────────────►◄────────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      [ Maturity Approaching ]     [ Statutory Tenure Met ]
               │                         │
     (7) Renewal Application     (8) Release & Refund Request
       - Same FDR Extended               │
       - Replacement Linked      (8a) Officer Scrutiny
               │                         │
     (7a) Officer Approval       (8b) Competent Authority Order
               │                         │
     [ Status: ACTIVE/RENEWED ]  (8c) Lien Revocation
                                         │
                                 [ Status: RELEASED ]
```

---

## 📡 Canonical API Contract (Problem Statement 26265)

### 1. FDR Master Records (`/api/fdr`)
- `GET /api/fdr/stats` — Dashboard metrics (Active, Expiring Soon, Matured, Released, Total Value)
- `GET /api/fdr` — Paginated FDR list with search, bank, status, and maturity filters
- `GET /api/fdr/:id` — Complete FDR record with linked documents, verifications, discrepancies, and renewals
- `POST /api/fdr` — Register new FDR (Draft or Submitted)
- `PUT /api/fdr/:id` — Update draft or pending FDR details
- `POST /api/fdr/:id/submit` — Formally submit draft FDR for officer verification
- `GET /api/fdr/:id/history` — Tamper-evident audit history of this instrument

### 2. Documents & Evidence (`/api/fdr`)
- `POST /api/fdr/:id/documents` — Multipart upload with SHA-256 integrity calculation
- `POST /api/fdr/documents/:docId/token` — Generate HMAC-SHA256 signed temporary token (5-min window)
- `GET /api/fdr/documents/:docId/download` — Authorized download stream
- `GET /api/fdr/documents/:docId/preview` — In-browser preview with watermarking
- `DELETE /api/fdr/documents/:docId` — Safe deletion of draft documents

### 3. Verification & Discrepancies (`/api/fdr-verification`)
- `GET /api/fdr-verification/pending` — Officer queue of instruments awaiting verification
- `POST /api/fdr-verification/:id/verify` — Record officer verification outcome (`VERIFIED`, `DEFICIENT`, `REJECTED`, `SUSPECTED_FRAUD`)
- `POST /api/fdr-verification/:id/discrepancy` — Issue formal discrepancy notice
- `POST /api/fdr-verification/discrepancy/:id/respond` — Institution clarification response
- `POST /api/fdr-verification/discrepancy/:id/resolve` — Officer resolves or waives discrepancy

### 4. Renewals & Replacements (`/api/fdr-renewals`)
- `GET /api/fdr-renewals/due` — List of instruments nearing maturity or matured past due date
- `GET /api/fdr-renewals` — Renewal application tracking list
- `POST /api/fdr-renewals/:fdrId/submit` — Submit renewal application (Extension or Replacement)
- `POST /api/fdr-renewals/:renewalId/review` — Officer review determination (`APPROVED`, `REJECTED`)

### 5. Release & Refund (`/api/fdr-releases`)
- `GET /api/fdr-releases` — List release and refund requests
- `POST /api/fdr-releases/:fdrId/request` — Institution requests release with statutory justification
- `POST /api/fdr-releases/:requestId/scrutiny` — Technical scrutiny by reviewing officer
- `POST /api/fdr-releases/:requestId/decision` — Competent Authority statutory release order
- `POST /api/fdr-releases/:requestId/complete` — Finalize lien removal and unblock funds

### 6. Analytics & Reports (`/api/fdr-reports`)
- `GET /api/fdr-reports/register` — Full FDR Register (JSON format or `?format=csv` export)
- `GET /api/fdr-reports/maturity-calendar` — 24-month forecast of scheduled deposit maturities
- `GET /api/fdr-reports/bank-distribution` — Volume and deposit amounts by scheduled bank
- `GET /api/fdr-reports/compliance-summary` — Regional compliance breakdown across AICTE regions

---

## 🔐 Security & Governance Guardrails

1. **Strict Multi-Tenant Isolation:**
   - Institutional users are strictly scoped to their own `institution_id`. Cross-tenant querying is rejected with `HTTP 403 Forbidden`.
2. **Deterministic Immutability:**
   - Every mutation generates an entry in `document_audit_trail` linked by SHA-256 cryptographic chain.
   - SQLite triggers `prevent_audit_update` and `prevent_audit_delete` guarantee ledger immutability.
3. **Public Uploads Blocked:**
   - Direct static access to `/uploads/` returns `HTTP 403 DIRECT_ACCESS_FORBIDDEN`. All file downloads must use authorized bearer tokens or signed HMAC-SHA256 tokens.
4. **Zero Mock Data in Production Paths:**
   - All dashboard figures, charts, registers, and verification lists are live relational queries against SQLite WAL database.
