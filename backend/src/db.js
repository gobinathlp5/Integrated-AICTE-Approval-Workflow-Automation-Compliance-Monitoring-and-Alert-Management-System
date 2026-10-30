const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'aicte.db');
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDb() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      institution_id TEXT,
      region TEXT,
      designation TEXT,
      is_active INTEGER DEFAULT 1,
      mfa_enabled INTEGER DEFAULT 0,
      mfa_secret TEXT,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Institutions table
    CREATE TABLE IF NOT EXISTS institutions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- Engineering, Management, Pharmacy, Architecture, etc.
      region TEXT NOT NULL, -- Northern, Western, Southern, Eastern, Central, South-Western, etc.
      state TEXT NOT NULL,
      city TEXT NOT NULL,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Applications table
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      application_number TEXT UNIQUE NOT NULL,
      institution_id TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      application_type TEXT NOT NULL, -- NEW_INSTITUTE, EXTENSION_OF_APPROVAL, VARIATION_IN_INTAKE, RENEWAL
      status TEXT NOT NULL, -- DRAFT, SUBMITTED, UNDER_SCRUTINY, SCRUTINY_DEFICIENT, UNDER_EVC, EVC_COMPLETED, UNDER_SAC, APPROVED, REJECTED
      region TEXT NOT NULL,
      assigned_scrutiny_officer_id TEXT,
      assigned_evc_committee_id TEXT,
      submission_date DATETIME,
      approval_date DATETIME,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    );

    -- EVC Committees table
    CREATE TABLE IF NOT EXISTS evc_committees (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      application_id TEXT NOT NULL,
      coordinator_id TEXT NOT NULL,
      status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, INSPECTED, REPORT_SUBMITTED, CLOSED
      inspection_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );

    -- EVC Committee Members mapping
    CREATE TABLE IF NOT EXISTS evc_committee_members (
      id TEXT PRIMARY KEY,
      committee_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      member_role TEXT DEFAULT 'MEMBER', -- COORDINATOR, EXPERT_MEMBER, REGIONAL_REPRESENTATIVE
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (committee_id) REFERENCES evc_committees(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(committee_id, user_id)
    );

    -- Role Permissions default configuration
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      is_allowed INTEGER DEFAULT 1,
      UNIQUE(role, permission)
    );

    -- User Permission Overrides (allows granting or denying specific permissions per user)
    CREATE TABLE IF NOT EXISTS user_permission_overrides (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      is_granted INTEGER NOT NULL, -- 1 = explicitly granted, 0 = explicitly denied
      granted_by TEXT NOT NULL,
      reason TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, permission)
    );

    -- Configurable Visibility Classifications
    CREATE TABLE IF NOT EXISTS visibility_classifications (
      code TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL,
      default_allowed_roles TEXT NOT NULL, -- JSON array of roles
      is_system INTEGER DEFAULT 1
    );

    -- Documents Repository
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      document_number TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      
      -- Metadata required by section C
      institution_id TEXT NOT NULL,
      application_id TEXT,
      document_category TEXT NOT NULL, -- LAND, BUILDING, FINANCIAL, FACULTY, AFFIDAVIT, UNDERTAKING, COMPLIANCE, RENEWAL, EVC_REPORT, SAC_REPORT, APPROVAL_LETTER
      folder_category TEXT NOT NULL, -- INSTITUTION, APPLICATION, UNDERTAKING, COMPLIANCE, RENEWAL, COMMITTEE_INSPECTION
      uploader_id TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      uploader_role TEXT NOT NULL,
      upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      verification_status TEXT DEFAULT 'PENDING', -- PENDING, VERIFIED, REJECTED, RETURNED_FOR_CORRECTION
      verified_by TEXT,
      verified_at DATETIME,
      verification_remarks TEXT,
      
      confidentiality_classification TEXT NOT NULL DEFAULT 'INSTITUTION_VISIBLE', 
      allowed_roles TEXT, -- JSON array of specific allowed roles or null for default category rules
      allowed_users TEXT, -- JSON array of specific allowed user IDs
      expiry_date DATE,
      document_version INTEGER DEFAULT 1,
      retention_status TEXT DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED, HOLD, PURGE_PROTECTED
      is_latest_version INTEGER DEFAULT 1,
      parent_document_id TEXT, -- For version chain
      
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id),
      FOREIGN KEY (uploader_id) REFERENCES users(id)
    );

    -- Document Versions History
    CREATE TABLE IF NOT EXISTS document_versions (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      uploaded_by_name TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      change_summary TEXT,
      FOREIGN KEY (document_id) REFERENCES documents(id)
    );

    -- Comments & Remarks (Multi-Channel Isolation)
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      document_id TEXT,
      application_id TEXT,
      institution_id TEXT NOT NULL,
      channel TEXT NOT NULL, -- INSTITUTION_VISIBLE, INTERNAL_AICTE, COMMITTEE_RESTRICTED, COMPETENT_AUTHORITY
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      author_role TEXT NOT NULL,
      comment_text TEXT NOT NULL,
      is_released_to_institution INTEGER DEFAULT 0,
      released_by TEXT,
      released_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );

    -- User Login History
    CREATE TABLE IF NOT EXISTS login_history (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username_attempted TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      status TEXT NOT NULL, -- SUCCESS, FAILED_BAD_CREDENTIALS, LOCKED, MFA_PENDING, MFA_FAILED
      failure_reason TEXT,
      attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Tamper-Evident Immutable Document Audit History with SHA-256 chain
    CREATE TABLE IF NOT EXISTS document_audit_trail (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audit_id TEXT UNIQUE NOT NULL,
      document_id TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      application_id TEXT,
      action TEXT NOT NULL, -- UPLOAD, VIEW, DOWNLOAD, REPLACE, VERIFY, RETURN, CHANGE_VISIBILITY, GRANT_ACCESS, REVOKE_ACCESS, DELETE_ATTEMPT
      performed_by_id TEXT NOT NULL,
      performed_by_name TEXT NOT NULL,
      performed_by_role TEXT NOT NULL,
      details TEXT, -- JSON containing diff or contextual information
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      previous_hash TEXT NOT NULL,
      entry_hash TEXT NOT NULL
    );

    -- Trigger to guarantee audit trail immutability (disallowing updates and deletes)
    CREATE TRIGGER IF NOT EXISTS prevent_audit_update
    BEFORE UPDATE ON document_audit_trail
    BEGIN
      SELECT RAISE(FAIL, 'Audit trail records are tamper-proof and cannot be updated.');
    END;

    CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
    BEFORE DELETE ON document_audit_trail
    BEGIN
      SELECT RAISE(FAIL, 'Audit trail records are tamper-proof and cannot be deleted.');
    END;
  `);

  console.log('Database schema created / verified.');
}

initDb();

module.exports = {
  db,
  initDb,
  uploadsDir
};
