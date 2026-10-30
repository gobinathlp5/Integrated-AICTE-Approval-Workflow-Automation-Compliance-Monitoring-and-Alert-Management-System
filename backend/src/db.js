const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

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
      aicte_id TEXT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- Engineering, Management, Pharmacy, Architecture, etc.
      region TEXT NOT NULL, -- Northern, Western, Southern, Eastern, Central, South-Western, etc.
      state TEXT NOT NULL,
      city TEXT NOT NULL,
      district TEXT,
      pincode TEXT,
      address TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      contact_person TEXT,
      phone TEXT,
      hoi_name TEXT,
      hoi_designation TEXT,
      establishment_year INTEGER,
      land_area_acres REAL,
      built_up_area_sqm REAL,
      programmes_offered TEXT,
      programmes_json TEXT,
      compliance_score REAL DEFAULT 85.0,
      status TEXT DEFAULT 'ACTIVE', -- ACTIVE, PENDING_VERIFICATION, SUSPENDED
      verified INTEGER DEFAULT 1,
      verified_by TEXT,
      verified_by_officer_id TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Applications table
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      application_number TEXT UNIQUE NOT NULL,
      institution_id TEXT NOT NULL,
      academic_year TEXT NOT NULL,
      application_type TEXT NOT NULL, -- NEW_INSTITUTE, EXTENSION_OF_APPROVAL, VARIATION_IN_INTAKE, RENEWAL
      status TEXT NOT NULL, -- DRAFT, SUBMITTED, UNDER_SCRUTINY, SCRUTINY_DEFICIENT, UNDER_EVC, EVC_COMPLETED, UNDER_SAC, APPROVED, REJECTED, ON_HOLD
      current_stage TEXT DEFAULT 'SUBMITTED',
      workflow_template_id TEXT,
      region TEXT NOT NULL,
      assigned_scrutiny_officer_id TEXT,
      assigned_evc_committee_id TEXT,
      is_on_hold INTEGER DEFAULT 0,
      hold_reason TEXT,
      hold_by TEXT,
      hold_at DATETIME,
      submission_date DATETIME,
      approval_date DATETIME,
      remarks TEXT,
      programmes_requested TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    );

    -- Workflow Templates (Configurable Workflow Engine)
    CREATE TABLE IF NOT EXISTS workflow_templates (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      application_category TEXT NOT NULL,
      stages_json TEXT NOT NULL, -- Array of stage objects with prerequisites & required roles
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Application Workflow History
    CREATE TABLE IF NOT EXISTS application_workflow_history (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      transitioned_by TEXT NOT NULL,
      transitioned_by_role TEXT NOT NULL,
      remarks TEXT,
      prerequisites_verified INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );

    -- Scrutiny Evaluations & Checklists
    CREATE TABLE IF NOT EXISTS scrutiny_evaluations (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      officer_id TEXT NOT NULL,
      officer_name TEXT NOT NULL,
      status TEXT DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, DEFICIENT, COMPLETED
      checklist_json TEXT NOT NULL, -- JSON array of criteria: land, built-up, faculty, finance, lab
      overall_remarks TEXT,
      recommendation TEXT, -- APPROVE_FOR_NEXT, DEFICIENCY_RAISED, EVC_RECOMMENDED, REJECT_RECOMMENDED
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id),
      FOREIGN KEY (officer_id) REFERENCES users(id)
    );

    -- Deficiencies raised during Scrutiny or EVC
    CREATE TABLE IF NOT EXISTS deficiencies (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      document_id TEXT,
      raised_by_id TEXT NOT NULL,
      raised_by_name TEXT NOT NULL,
      raised_by_role TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      severity TEXT DEFAULT 'MAJOR', -- CRITICAL, MAJOR, MINOR
      status TEXT DEFAULT 'OPEN', -- OPEN, RESOLVED, WAIVED
      statutory_clause TEXT,
      remedy_instructions TEXT,
      deadline_days INTEGER DEFAULT 15,
      institution_response TEXT,
      response_document_id TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id)
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

    -- EVC Inspection Reports & Details
    CREATE TABLE IF NOT EXISTS evc_inspections (
      id TEXT PRIMARY KEY,
      committee_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      scheduled_date DATE NOT NULL,
      status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, RESCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED
      inspection_type TEXT DEFAULT 'REGULAR',
      committee_leader_id TEXT,
      agenda TEXT,
      checklist_json TEXT, -- Physical infrastructure, safety, computing, workshops
      findings TEXT,
      findings_summary TEXT,
      outcome TEXT,
      infrastructure_satisfactory INTEGER DEFAULT 1,
      faculty_satisfactory INTEGER DEFAULT 1,
      deficiency_found INTEGER DEFAULT 0,
      recommendation TEXT, -- RECOMMENDED_APPROVAL, RECOMMENDED_REJECTION, RE_INSPECT
      report_file_id TEXT,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (committee_id) REFERENCES evc_committees(id),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );

    -- EVC Geo-tagged Evidence
    CREATE TABLE IF NOT EXISTS evc_evidence (
      id TEXT PRIMARY KEY,
      inspection_id TEXT NOT NULL,
      evidence_type TEXT NOT NULL, -- PHOTO, VIDEO, DOCUMENT
      title TEXT NOT NULL,
      file_title TEXT,
      geo_lat REAL,
      geo_lng REAL,
      latitude REAL,
      longitude REAL,
      remarks TEXT,
      file_path TEXT NOT NULL,
      uploader_id TEXT NOT NULL,
      uploaded_by_user_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inspection_id) REFERENCES evc_inspections(id)
    );

    -- SAC / SHC Committees
    CREATE TABLE IF NOT EXISTS sac_committees (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- SAC, SHC
      hearing_date DATE,
      status TEXT DEFAULT 'ACTIVE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sac_hearings (
      id TEXT PRIMARY KEY,
      committee_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      scheduled_at DATETIME NOT NULL,
      meeting_mode TEXT DEFAULT 'VIRTUAL',
      committee_chair TEXT,
      committee_members TEXT,
      appellant_name TEXT,
      hearing_summary TEXT,
      observations TEXT,
      reasoning TEXT,
      condition_notes TEXT,
      recommendation TEXT, -- APPROVE_GRANT, REJECT_GRANT, REMAND_TO_EVC
      status TEXT DEFAULT 'SCHEDULED', -- SCHEDULED, COMPLETED, ADJOURNED
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (committee_id) REFERENCES sac_committees(id),
      FOREIGN KEY (application_id) REFERENCES applications(id)
    );

    -- Competent Authority Formal Decision Orders
    CREATE TABLE IF NOT EXISTS authority_decisions (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      decision_maker_id TEXT NOT NULL,
      decision_maker_name TEXT NOT NULL,
      authority_user_id TEXT,
      authority_name TEXT,
      authority_role TEXT,
      decision TEXT NOT NULL, -- APPROVED, REJECTED
      order_number TEXT UNIQUE NOT NULL,
      formal_order_number TEXT,
      order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_intake INTEGER,
      validity_years INTEGER DEFAULT 1,
      reasoning TEXT,
      remarks TEXT,
      conditions TEXT,
      previous_status TEXT,
      new_status TEXT,
      prerequisites_verified INTEGER DEFAULT 1,
      signed_order_doc_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id),
      FOREIGN KEY (decision_maker_id) REFERENCES users(id)
    );

    -- Undertaking Templates
    CREATE TABLE IF NOT EXISTS undertaking_templates (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL, -- ANTI_RAGGING, LAND_CONTIGUITY, FACULTY_CADRE, COMPLIANCE
      is_mandatory INTEGER DEFAULT 1,
      content_template TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Submitted Undertakings
    CREATE TABLE IF NOT EXISTS undertakings (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      application_id TEXT,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING', -- PENDING, SUBMITTED, VERIFIED, REJECTED, EXPIRED
      document_id TEXT,
      valid_from DATE,
      valid_until DATE,
      validity_date DATE,
      remarks TEXT,
      verification_remarks TEXT,
      verified_by TEXT,
      verified_by_user_id TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (template_id) REFERENCES undertaking_templates(id),
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    );

    -- Compliance Obligations & Monitoring
    CREATE TABLE IF NOT EXISTS compliance_obligations (
      id TEXT PRIMARY KEY,
      institution_id TEXT NOT NULL,
      application_id TEXT,
      title TEXT NOT NULL,
      category TEXT NOT NULL, -- ACADEMIC, INFRASTRUCTURE, FACULTY, FINANCIAL, REGULATORY
      obligation_category TEXT,
      academic_year TEXT,
      description TEXT,
      due_date DATE NOT NULL,
      status TEXT DEFAULT 'PENDING', -- PENDING, SUBMITTED, VERIFIED, OVERDUE, NON_COMPLIANT
      evidence_doc_id TEXT,
      evidence_notes TEXT,
      submitted_at DATETIME,
      penalty_clause TEXT,
      compliance_score REAL DEFAULT 100.0,
      verified_by TEXT,
      verified_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    );

    -- In-app Notifications Center
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      role_target TEXT,
      institution_id TEXT,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT DEFAULT 'INFO', -- INFO, WARNING, DEFICIENCY, ESCALATION, SUCCESS
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Escalation Management
    CREATE TABLE IF NOT EXISTS escalations (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      institution_id TEXT NOT NULL,
      escalation_level TEXT NOT NULL, -- LEVEL_1, LEVEL_2, LEVEL_3
      reason TEXT NOT NULL,
      assigned_to_role TEXT NOT NULL,
      assigned_to_user_id TEXT,
      status TEXT DEFAULT 'ACTIVE', -- ACTIVE, RESOLVED, SUPERSEDED
      resolution_notes TEXT,
      resolved_by TEXT,
      resolved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES applications(id),
      FOREIGN KEY (institution_id) REFERENCES institutions(id)
    );

    -- Role Permissions default configuration
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      permission TEXT NOT NULL,
      is_allowed INTEGER DEFAULT 1,
      UNIQUE(role, permission)
    );

    -- User Permission Overrides
    CREATE TABLE IF NOT EXISTS user_permission_overrides (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      permission TEXT NOT NULL,
      is_granted INTEGER NOT NULL,
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
      default_allowed_roles TEXT NOT NULL,
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
      
      institution_id TEXT NOT NULL,
      application_id TEXT,
      document_category TEXT NOT NULL,
      folder_category TEXT NOT NULL,
      uploader_id TEXT NOT NULL,
      uploader_name TEXT NOT NULL,
      uploader_role TEXT NOT NULL,
      upload_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      verification_status TEXT DEFAULT 'PENDING',
      verified_by TEXT,
      verified_at DATETIME,
      verification_remarks TEXT,
      
      confidentiality_classification TEXT NOT NULL DEFAULT 'INSTITUTION_VISIBLE', 
      allowed_roles TEXT,
      allowed_users TEXT,
      expiry_date DATE,
      document_version INTEGER DEFAULT 1,
      retention_status TEXT DEFAULT 'ACTIVE',
      is_latest_version INTEGER DEFAULT 1,
      parent_document_id TEXT,
      
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
      channel TEXT NOT NULL,
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
      status TEXT NOT NULL,
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
      action TEXT NOT NULL,
      performed_by_id TEXT NOT NULL,
      performed_by_name TEXT NOT NULL,
      performed_by_role TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      previous_hash TEXT NOT NULL,
      entry_hash TEXT NOT NULL
    );

    -- Trigger to guarantee audit trail immutability
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

    -- Versioned Database Migrations Tracker
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safely check and add any missing columns in existing tables
  try {
    const ensureColumns = (tableName, columnMap) => {
      try {
        const existing = db.prepare(`PRAGMA table_info(${tableName})`).all().map(c => c.name);
        for (const [colName, colType] of Object.entries(columnMap)) {
          if (!existing.includes(colName)) {
            db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${colName} ${colType}`).run();
          }
        }
      } catch (e) {
        console.warn(`Column check failed for ${tableName}:`, e.message);
      }
    };

    ensureColumns('users', {
      mfa_temp_code: "TEXT",
      mfa_code_expires_at: "DATETIME",
      mfa_attempts: "INTEGER DEFAULT 0",
      reset_token: "TEXT",
      reset_token_expires_at: "DATETIME"
    });

    ensureColumns('applications', {
      current_stage: "TEXT DEFAULT 'SUBMITTED'",
      workflow_template_id: "TEXT",
      is_on_hold: "INTEGER DEFAULT 0",
      hold_reason: "TEXT",
      hold_by: "TEXT",
      hold_at: "DATETIME",
      programmes_requested: "TEXT"
    });

    ensureColumns('institutions', {
      aicte_id: "TEXT",
      district: "TEXT",
      pincode: "TEXT",
      address: "TEXT",
      contact_email: "TEXT",
      contact_phone: "TEXT",
      contact_person: "TEXT",
      phone: "TEXT",
      hoi_name: "TEXT",
      hoi_designation: "TEXT",
      establishment_year: "INTEGER",
      land_area_acres: "REAL",
      built_up_area_sqm: "REAL",
      programmes_offered: "TEXT",
      programmes_json: "TEXT",
      compliance_score: "REAL DEFAULT 85.0",
      verified: "INTEGER DEFAULT 1",
      verified_by: "TEXT",
      verified_by_officer_id: "TEXT",
      verified_at: "DATETIME"
    });

    ensureColumns('deficiencies', {
      statutory_clause: "TEXT",
      remedy_instructions: "TEXT",
      deadline_days: "INTEGER DEFAULT 15"
    });

    ensureColumns('evc_committees', {
      region: "TEXT",
      coordinator_id: "TEXT"
    });

    ensureColumns('evc_committee_members', {
      member_role: "TEXT DEFAULT 'MEMBER'",
      role_in_committee: "TEXT"
    });

    ensureColumns('evc_inspections', {
      inspection_type: "TEXT DEFAULT 'REGULAR'",
      committee_leader_id: "TEXT",
      findings_summary: "TEXT",
      outcome: "TEXT",
      infrastructure_satisfactory: "INTEGER DEFAULT 1",
      faculty_satisfactory: "INTEGER DEFAULT 1",
      deficiency_found: "INTEGER DEFAULT 0"
    });

    ensureColumns('evc_evidence', {
      file_title: "TEXT",
      latitude: "REAL",
      longitude: "REAL",
      remarks: "TEXT",
      uploaded_by_user_id: "TEXT"
    });

    ensureColumns('sac_hearings', {
      meeting_mode: "TEXT DEFAULT 'VIRTUAL'",
      committee_chair: "TEXT",
      committee_members: "TEXT",
      reasoning: "TEXT",
      condition_notes: "TEXT"
    });

    ensureColumns('authority_decisions', {
      authority_user_id: "TEXT",
      authority_name: "TEXT",
      authority_role: "TEXT",
      formal_order_number: "TEXT",
      approved_intake: "INTEGER",
      validity_years: "INTEGER DEFAULT 1",
      reasoning: "TEXT"
    });

    ensureColumns('undertakings', {
      validity_date: "DATE",
      remarks: "TEXT",
      verification_remarks: "TEXT",
      verified_by_user_id: "TEXT"
    });

    ensureColumns('compliance_obligations', {
      obligation_category: "TEXT",
      academic_year: "TEXT",
      evidence_notes: "TEXT",
      submitted_at: "DATETIME"
    });

    // Record and execute versioned schema migrations
    const migrations = [
      { version: 1, name: 'Core Schema (Users, Institutions, Applications)' },
      { version: 2, name: 'Workflow Templates and Transition History' },
      { version: 3, name: 'Scrutiny Evaluations and Deficiencies' },
      { version: 4, name: 'EVC Committees, Members, Inspections and Evidence' },
      { version: 5, name: 'SAC Committees and Hearings' },
      { version: 6, name: 'Competent Authority Decisions and Undertakings' },
      { version: 7, name: 'Compliance Obligations, Notifications and Escalations' },
      { version: 8, name: 'Document Security, Audit Trail and Immutable Triggers' },
      { version: 9, name: 'Cryptographic MFA, Account Recovery and Institutional Verification Lifecycle' }
    ];

    const recordMigration = db.prepare('INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (?, ?)');
    for (const m of migrations) {
      recordMigration.run(m.version, m.name);
    }
  } catch (err) {
    console.warn('Column migration check notice:', err.message);
  }

  console.log('AICTE Digital Governance database schema created & synchronized.');
}

initDb();

module.exports = {
  db,
  initDb,
  uploadsDir
};
