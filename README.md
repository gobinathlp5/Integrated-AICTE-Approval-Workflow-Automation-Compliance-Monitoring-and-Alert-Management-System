# Integrated AICTE Approval Workflow Automation, Compliance Monitoring and Alert Management System

[![CI/CD Pipeline](https://github.com/gobinathlp5/Integrated-AICTE-Approval-Workflow-Automation-Compliance-Monitoring-and-Alert-Management-System/actions/workflows/ci.yml/badge.svg)](https://github.com/gobinathlp5/Integrated-AICTE-Approval-Workflow-Automation-Compliance-Monitoring-and-Alert-Management-System/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node: >=18.0.0](https://img.shields.io/badge/Node->=18.0.0-green.svg)](https://nodejs.org/)
[![Database: SQLite WAL](https://img.shields.io/badge/Database-SQLite_WAL_Mode-informational.svg)](https://sqlite.org/)

**Problem Statement ID:** 26262  
**Organization:** All India Council for Technical Education (AICTE)  
**Department:** Regulation Bureau  
**Theme:** Smart Automation  
**Product Identity:** AICTE Digital Governance — Approval & Compliance Management Portal  

---

## 🏛️ Executive Summary

The **Integrated AICTE Approval Workflow Automation, Compliance Monitoring and Alert Management System** is a government-grade digital portal engineered to streamline, digitize, and automate the end-to-end regulatory approval lifecycle for technical education institutions across India.

Designed specifically for the AICTE Regulation Bureau under Smart Automation, this platform replaces fragmented paperwork with a unified regulatory operating system featuring:
- **Centralized Authentication & RBAC:** Multi-tenant isolation across 13 administrative roles.
- **Dynamic Cryptographic MFA:** Zero hardcoded codes; salted bcrypt OTP verification.
- **Statutory Workflow Automation:** State machine guiding applications from intake to Scrutiny, EVC inspections, SAC hearings, and Competent Authority approvals.
- **Tamper-Evident Document Vault:** Magic-byte validation, HMAC-SHA256 signed download tokens, watermarked preview, and SHA-256 audit ledger chaining.
- **Compliance Scorecards & Statutory Undertakings:** Automated real-time institutional compliance scoring and tracking of legal undertakings.
- **SLA & Escalation Engine:** Background scheduler automatically detecting overdue approvals and dispatching multi-tiered escalations.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18.x or v20.x)
- npm (v9.x or higher)

### 2. Automated Test Suite (Security, Integration & Workflow)
Run all 52 automated tests verifying tenant isolation, cryptographic MFA, and end-to-end statutory workflows:
```bash
npm test
```

### 3. Running the Complete Application

Run both backend and frontend concurrently:
```bash
npm start
```
Or start each service independently:

**Backend API Service:**
```bash
npm run start:backend
# API server listening on http://localhost:5000
```

**Frontend Portal:**
```bash
npm run start:frontend
# Client web application available at http://localhost:3000
```

---

## 👥 Pre-Configured Personas & Test Credentials

All pre-configured testing accounts share the standardized test password: `Password@123`

| Role Category | Username | Persona / Scope | Administrative Authority |
|---|---|---|---|
| **Super Administrator** | `superadmin` | Dr. T. G. Sitharam | Full Platform & System Governance |
| **AICTE Administrator** | `aicteadmin` | Shri Manoj Kumar | Portal Configuration & RBAC Management |
| **Regulation Bureau Officer** | `regbureau` | Prof. Rajive Kumar | Regulation Bureau Policy & Oversight |
| **Regional Officer** | `regionalofficer` | Dr. Sunil Luthra | Northern Regional Directorate Verification |
| **Bureau Officer** | `bureauofficer` | Smt. Vandana Sharma | National Approval Bureau Management |
| **Scrutiny Officer** | `scrutinyofficer` | Dr. R. K. Sharma | Statutory Evaluation & Deficiency Issuance |
| **EVC Coordinator** | `evccoordinator` | Prof. Anjali Mathur | Expert Committee Inspection Scheduling |
| **EVC Member (Assigned)** | `evcmember` | Dr. Vikramaditya Sen | Inspection Execution & Report Submission |
| **EVC Member (Unassigned)** | `evcmember2` | Dr. Ramesh Joshi | Unassigned Inspection Panel (ABAC Testing) |
| **SAC/SHC Member** | `sacmember` | Prof. D. K. Murthy | Standing Appellate Committee Jurist |
| **Competent Authority** | `competentauthority` | Appellate Authority | Exclusive Statutory Approval Order Signing |
| **Institution A Admin** | `instadmin` | Dr. Arvind Verma | Delhi Institute of Technology (Applicant) |
| **Institution A Staff** | `inststaff` | Sri Ramesh Narayan | Delhi Institute Registrar / Submission Staff |
| **Institution B Admin** | `instadmin_b` | Dr. Suresh Patil | Mumbai College of Engineering (Tenant B) |
| **Statutory Auditor (CAG)** | `auditor` | Shri Alok Jain | Strict Read-Only Statutory Oversight & Auditing |

---

## 🔐 Core Security & Architectural Highlights

### 1. Strict Multi-Tenant Isolation
- Institutional applicants cannot view or query applications, documents, or deficiencies belonging to another institution (`HTTP 403 Forbidden`).
- Document downloads require HMAC-SHA256 cryptographically signed tokens with strict 5-minute time windows.

### 2. Dynamic Cryptographic Multi-Factor Authentication
- Eradicated all hardcoded demonstration OTPs.
- Uses cryptographically secure pseudorandom numbers (`crypto.randomInt`), salted with bcrypt, and bounded by a 5-minute time-to-live with a 3-attempt lockout policy.

### 3. Binary Magic Byte Validation & Safe Storage
- Prevents file spoofing and malicious executable uploads (`PE MZ`, scripts).
- Whitelists only `%PDF-`, PNG, JPEG, and Word formats with full SHA-256 integrity checksumming.
- Enforces path sanitization to eliminate directory traversal attacks (`../`).

### 4. Tamper-Evident Cryptographic Ledger
- Audit entries are cryptographically chained:
  $$H_i = \text{SHA-256}(H_{i-1} \parallel \text{audit\_id} \parallel \text{action} \parallel \text{user\_id} \parallel \text{timestamp})$$
- SQLite database triggers prevent any modification (`UPDATE` or `DELETE`) to existing audit entries.

### 5. Automated SLA Escalation Engine
- Continuously scans applications exceeding statutory review timelines (Scrutiny > 14 days, EVC > 21 days, Expiring Undertakings < 30 days).
- Dispatches multi-level escalation notices to regional and bureau directors.

---

## 📁 Repository Structure

```
├── .github/
│   └── workflows/
│       └── ci.yml               # Automated CI/CD test and build validation
├── backend/
│   ├── data/
│   │   └── aicte.db             # SQLite WAL database with versioned migrations
│   ├── src/
│   │   ├── routes/              # Express API route modules (Auth, App, Doc, EVC, etc.)
│   │   ├── auth.js              # Cryptographic authentication & RBAC kernel
│   │   ├── db.js                # Database schema, triggers & versioned migrations
│   │   ├── scheduler.js         # SLA monitoring & automated escalation daemon
│   │   ├── server.js            # Express server initialization
│   │   └── tokenService.js      # HMAC-SHA256 document access token generator
│   ├── tests/
│   │   ├── security.test.js     # Security & tenant isolation test suite
│   │   ├── api-integration.test.js # API contract & RBAC integration tests
│   │   └── e2e-workflow.test.js # Full statutory approval workflow test suite
│   └── .env.example             # Environment variable specification template
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components & Government navigation bar
│   │   ├── pages/               # Role-specific dashboards & workflow views
│   │   ├── services/            # Centralized API service client
│   │   ├── App.jsx              # Routing & role-based view switcher
│   │   └── main.jsx             # React entry point
│   └── package.json             # Frontend dependencies & build script
├── docs/
│   └── ARCHITECTURE_AND_SECURITY.md # Deep technical architecture specifications
├── ARCHITECTURE.md              # System architecture & data flow diagrams
└── README.md                    # Official Project Overview & Instructions
```

---

## 🧪 Verification & Acceptance Evidence

Automated tests provide verifiable proof of compliance:

```
========================================================
AICTE PLATFORM: RUNNING MANDATORY SECURITY & ACCEPTANCE TESTS
========================================================
[✅ PASS] SEC-TEST-01: Institution A cannot access Institution B's documents
[✅ PASS] SEC-TEST-02: Institution cannot access internal AICTE notes
[✅ PASS] SEC-TEST-03: Unassigned EVC member cannot access another committee's documents
[✅ PASS] SEC-TEST-04: Scrutiny officer cannot modify institution statutory files
[✅ PASS] SEC-TEST-05: Auditor cannot modify records (Read-Only Statutory Enforcement)
[✅ PASS] SEC-TEST-06: Anti-IDOR URL & parameter tampering protection
[✅ PASS] SEC-TEST-07: Expired cryptographic access links cannot be reused
[✅ PASS] SEC-TEST-08: Tamper-evident SHA-256 audit ledger integrity verified
[✅ PASS] SEC-TEST-09: Universal 123456 MFA code strictly rejected
========================================================
API INTEGRATION SUMMARY: 30 PASSED, 0 FAILED.
========================================================
END-TO-END WORKFLOW SUMMARY: 13 PASSED, 0 FAILED.
========================================================
TOTAL: 52 PASSED, 0 FAILED.
```

---

## 📜 Regulatory Disclaimer

This software has been developed in strict alignment with AICTE Approval Process Handbook (APH) norms and Government of India regulatory standards for Problem Statement 26262.
