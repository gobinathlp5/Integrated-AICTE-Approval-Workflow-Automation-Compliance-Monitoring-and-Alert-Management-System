# AICTE Centralized Authentication & Access Management Platform

Production-ready implementation of Centralized Login, Role-Based Access Control (RBAC), Multi-Tenant Isolation, and Document Visibility for the AICTE Approval and Governance System.

---

## 🚀 Quick Start Guide

### 1. Run Automated Security & Acceptance Tests
Verifies all 8 mandatory security controls and the Section I acceptance scenario:
```bash
npm test
```

### 2. Start Backend API Server
```bash
npm run start:backend
```
The backend API server starts at `http://localhost:5000`.

### 3. Start Frontend Development Server
In a separate terminal:
```bash
npm run start:frontend
```
Open `http://localhost:3000` in your web browser.

---

## 👥 Demo Credentials (All 13 Roles Pre-Configured)

All demo accounts use password: `Password@123`

| Role Category | Username | Persona / Scope |
|---|---|---|
| **Super Administrator** | `superadmin` | Dr. T. G. Sitharam (Full Platform Governance) |
| **AICTE Administrator** | `aicteadmin` | Shri Manoj Kumar (Portal & RBAC Admin) |
| **Regulation Bureau Officer** | `regbureau` | Prof. Rajive Kumar (Bureau Head) |
| **Regional Officer** | `regionalofficer` | Dr. Sunil Luthra (Northern Regional Directorate) |
| **Bureau Officer** | `bureauofficer` | Smt. Vandana Sharma (Approval Bureau) |
| **Scrutiny Officer** | `scrutinyofficer` | Dr. R. K. Sharma (Assigned Evaluator for Delhi Inst.) |
| **EVC Coordinator** | `evccoordinator` | Prof. Anjali Mathur (Inspection Directorate) |
| **EVC Committee Member (Assigned)** | `evcmember` | Dr. Vikramaditya Sen (Delhi Inspection Panel) |
| **EVC Committee Member (Unassigned)** | `evcmember2` | Dr. Ramesh Joshi (Mumbai Panel - Testing ABAC) |
| **SAC/SHC Member** | `sacmember` | Prof. D. K. Murthy (Standing Appellate Jurist) |
| **Competent Authority** | `competentauthority` | Appellate Authority (Exclusive Approval Power) |
| **Institution A Admin** | `instadmin` | Dr. Arvind Verma (Delhi Institute of Technology) |
| **Institution A Staff** | `inststaff` | Sri Ramesh Narayan (Delhi Institute Registrar) |
| **Institution B Admin** | `instadmin_b` | Dr. Suresh Patil (Mumbai College - Testing Isolation) |
| **Statutory Auditor (CAG)** | `auditor` | Shri Alok Jain (Strictly Read-Only Statutory Auditor) |

---

## 🛡️ Key Features Implemented

1. **Centralized Authentication (Section A)**
   - Single secure entry point for all 13 user categories.
   - Public registration strictly restricted to Institution accounts (blocks public selection of AICTE officer roles).
   - Account lockout after 5 failed attempts (15-min lockout) and full login history tracking.
   - Optional TOTP / 2FA verification.

2. **Backend-Enforced RBAC & Data Isolation (Section B)**
   - Matrix of 13 Roles × 13 Permissions with dynamic individual user overrides.
   - Tenant isolation: Institution-level, Region-level, and Assignment-level ABAC.

3. **Document-Level Visibility & Repository (Sections C, D, F)**
   - Independent document metadata: uploader, classification, allowed roles, expiry date, version, checksum.
   - Configurable visibility classes: `INSTITUTION_VISIBLE`, `INTERNAL_AICTE`, `COMMITTEE_RESTRICTED`, `HIGHLY_RESTRICTED`.
   - Virtual folders: Institution-wise, Application-wise, Undertaking, Compliance, Renewal, Committee Inspection.
   - HMAC-SHA256 time-limited signed download tokens (prevent link reuse).
   - Watermarked in-browser preview.
   - Officer verify / return workflow and replacement version chain.

4. **Multi-Channel Communication Separation (Section E)**
   - Channels for Institution Remarks, Internal AICTE Notes, Committee Observations, and Competent Authority Remarks.
   - Internal notes remain hidden from institution accounts until an authorized officer explicitly triggers release.

5. **Tamper-Evident Immutable Audit Ledger (Section G)**
   - SHA-256 cryptographic chaining ($H_i = \text{SHA-256}(H_{i-1} \parallel \dots)$).
   - SQLite triggers prevent UPDATE and DELETE modifications.
   - 1-click integrity recalculation and verification tool.

6. **Interactive Security Test Runner (Sections H & I)**
   - Built-in runner testing all 8 mandatory security criteria and the complete Section I acceptance scenario.
