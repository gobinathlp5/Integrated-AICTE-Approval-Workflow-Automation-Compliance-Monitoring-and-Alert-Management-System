const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { db, uploadsDir } = require('./db');
const { ROLES, VISIBILITY_CATEGORIES } = require('./rbac');
const { recordDocumentAudit } = require('./audit');

function seedDatabase() {
  console.log('Seeding AICTE test environment...');

  // Default hashed password for all demo accounts: 'Password@123'
  const defaultPasswordHash = bcrypt.hashSync('Password@123', 10);

  // 1. Seed Institutions
  const insertInst = db.prepare(`
    INSERT OR REPLACE INTO institutions (id, code, name, type, region, state, city, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInst.run(
    'inst_delhi_001',
    '1-1002345671',
    'Delhi Institute of Technology & Advanced Science',
    'Engineering & Technology',
    'Northern',
    'Delhi',
    'New Delhi',
    'ACTIVE'
  );

  insertInst.run(
    'inst_mumbai_002',
    '1-2009876542',
    'Mumbai College of Engineering & Research (Institution B)',
    'Engineering & Management',
    'Western',
    'Maharashtra',
    'Mumbai',
    'ACTIVE'
  );

  insertInst.run(
    'inst_blr_003',
    '1-3004567893',
    'Bengaluru National Institute of Technology',
    'Engineering & Technology',
    'South-Western',
    'Karnataka',
    'Bengaluru',
    'ACTIVE'
  );

  // 2. Seed Users across all 13 Roles
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (
      id, username, email, password_hash, full_name, role, institution_id, region, designation, is_active, mfa_enabled, mfa_secret
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demoUsers = [
    {
      id: 'usr_super_01',
      username: 'superadmin',
      email: 'superadmin@aicte-india.org',
      fullName: 'Dr. T. G. Sitharam (Super Admin)',
      role: ROLES.SUPER_ADMIN,
      instId: null,
      region: 'Central HQ',
      designation: 'Chief Platform Administrator',
      mfa: 0
    },
    {
      id: 'usr_aicte_admin_01',
      username: 'aicteadmin',
      email: 'aicteadmin@aicte-india.org',
      fullName: 'Shri Manoj Kumar (AICTE Admin)',
      role: ROLES.AICTE_ADMIN,
      instId: null,
      region: 'Central HQ',
      designation: 'Director, e-Governance Cell',
      mfa: 0
    },
    {
      id: 'usr_reg_bureau_01',
      username: 'regbureau',
      email: 'regulation@aicte-india.org',
      fullName: 'Prof. Rajive Kumar (Regulation Bureau)',
      role: ROLES.REGULATION_BUREAU,
      instId: null,
      region: 'Central HQ',
      designation: 'Member Secretary & Bureau Head',
      mfa: 0
    },
    {
      id: 'usr_regional_north_01',
      username: 'regionalofficer',
      email: 'ro.north@aicte-india.org',
      fullName: 'Dr. Sunil K. Luthra (Regional Officer)',
      role: ROLES.REGIONAL_OFFICER,
      instId: null,
      region: 'Northern',
      designation: 'Regional Officer (North)',
      mfa: 0
    },
    {
      id: 'usr_bureau_01',
      username: 'bureauofficer',
      email: 'approval.bureau@aicte-india.org',
      fullName: 'Smt. Vandana Sharma (Bureau Officer)',
      role: ROLES.BUREAU_OFFICER,
      instId: null,
      region: 'Northern',
      designation: 'Joint Director (Approval Bureau)',
      mfa: 0
    },
    {
      id: 'usr_scrutiny_01',
      username: 'scrutinyofficer',
      email: 'scrutiny.sharma@aicte-india.org',
      fullName: 'Dr. R. K. Sharma (Scrutiny Officer)',
      role: ROLES.SCRUTINY_OFFICER,
      instId: null,
      region: 'Northern',
      designation: 'Senior Scrutiny Evaluator',
      mfa: 0
    },
    {
      id: 'usr_evc_coord_01',
      username: 'evccoordinator',
      email: 'evc.coord@aicte-india.org',
      fullName: 'Prof. Anjali Mathur (EVC Coordinator)',
      role: ROLES.EVC_COORDINATOR,
      instId: null,
      region: 'Northern',
      designation: 'EVC Regional Inspection Coordinator',
      mfa: 0
    },
    {
      id: 'usr_evc_member_01',
      username: 'evcmember',
      email: 'evc.member.delhi@aicte-india.org',
      fullName: 'Dr. Vikramaditya Sen (Assigned EVC Member)',
      role: ROLES.EVC_MEMBER,
      instId: null,
      region: 'Northern',
      designation: 'Expert Committee Inspector (Delhi Panel)',
      mfa: 0
    },
    {
      id: 'usr_evc_member_02',
      username: 'evcmember2',
      email: 'evc.member.west@aicte-india.org',
      fullName: 'Dr. Ramesh Joshi (Unassigned EVC Member)',
      role: ROLES.EVC_MEMBER,
      instId: null,
      region: 'Western',
      designation: 'Expert Committee Inspector (Mumbai Panel)',
      mfa: 0
    },
    {
      id: 'usr_sac_01',
      username: 'sacmember',
      email: 'sac.committee@aicte-india.org',
      fullName: 'Prof. D. K. Murthy (SAC/SHC Member)',
      role: ROLES.SAC_SHC_MEMBER,
      instId: null,
      region: 'Central HQ',
      designation: 'Standing Appellate Committee Jurist',
      mfa: 0
    },
    {
      id: 'usr_competent_01',
      username: 'competentauthority',
      email: 'chairman@aicte-india.org',
      fullName: 'Competent Authority (Appellate / Chairman)',
      role: ROLES.COMPETENT_AUTHORITY,
      instId: null,
      region: 'Central HQ',
      designation: 'Competent Decision Authority',
      mfa: 0
    },
    {
      id: 'usr_inst_admin_delhi',
      username: 'instadmin',
      email: 'director@dit-delhi.ac.in',
      fullName: 'Dr. Arvind Verma (Institution A Admin)',
      role: ROLES.INSTITUTION_ADMIN,
      instId: 'inst_delhi_001',
      region: 'Northern',
      designation: 'Principal & Director',
      mfa: 0
    },
    {
      id: 'usr_inst_staff_delhi',
      username: 'inststaff',
      email: 'registrar@dit-delhi.ac.in',
      fullName: 'Sri Ramesh Narayan (Institution A Staff)',
      role: ROLES.INSTITUTION_STAFF,
      instId: 'inst_delhi_001',
      region: 'Northern',
      designation: 'Registrar & Compliance Head',
      mfa: 0
    },
    {
      id: 'usr_inst_admin_mumbai',
      username: 'instadmin_b',
      email: 'principal@mumbai-engg.edu.in',
      fullName: 'Dr. Suresh Patil (Institution B Admin)',
      role: ROLES.INSTITUTION_ADMIN,
      instId: 'inst_mumbai_002',
      region: 'Western',
      designation: 'Director (Mumbai College)',
      mfa: 0
    },
    {
      id: 'usr_auditor_01',
      username: 'auditor',
      email: 'cag.auditor@cag.gov.in',
      fullName: 'Shri Alok K. Jain (CAG / AICTE Auditor)',
      role: ROLES.AUDITOR,
      instId: null,
      region: 'Central HQ',
      designation: 'Principal Statutory Auditor (Read-Only)',
      mfa: 0
    }
  ];

  demoUsers.forEach(u => {
    insertUser.run(
      u.id,
      u.username,
      u.email,
      defaultPasswordHash,
      u.fullName,
      u.role,
      u.instId,
      u.region,
      u.designation,
      1, // is_active
      u.mfa,
      '123456'
    );
  });

  // 3. Seed Applications
  const insertApp = db.prepare(`
    INSERT OR REPLACE INTO applications (
      id, application_number, institution_id, academic_year, application_type,
      status, region, assigned_scrutiny_officer_id, assigned_evc_committee_id,
      submission_date, remarks
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertApp.run(
    'app_2026_del_01',
    'AICTE/2026-27/1-1002345671',
    'inst_delhi_001',
    '2026-2027',
    'EXTENSION_OF_APPROVAL',
    'UNDER_SCRUTINY',
    'Northern',
    'usr_scrutiny_01',
    'evc_comm_01',
    '2026-10-15 10:30:00',
    'Submitted for annual Extension of Approval (EoA) and Increase in Intake for B.Tech CSE.'
  );

  insertApp.run(
    'app_2026_mum_02',
    'AICTE/2026-27/1-2009876542',
    'inst_mumbai_002',
    '2026-2027',
    'NEW_INSTITUTE',
    'DRAFT',
    'Western',
    null,
    'evc_comm_02',
    '2026-10-20 14:15:00',
    'Application for establishment of New Engineering College in Pune/Mumbai outskirts.'
  );

  // 4. Seed EVC Committees & Member assignments
  const insertComm = db.prepare(`
    INSERT OR REPLACE INTO evc_committees (id, code, name, application_id, coordinator_id, status, inspection_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertComm.run(
    'evc_comm_01',
    'EVC-2026-NORTH-042',
    'Northern Expert Visiting Committee - Delhi Panel A',
    'app_2026_del_01',
    'usr_evc_coord_01',
    'SCHEDULED',
    '2026-11-10'
  );

  insertComm.run(
    'evc_comm_02',
    'EVC-2026-WEST-019',
    'Western Expert Visiting Committee - Mumbai Panel B',
    'app_2026_mum_02',
    'usr_evc_coord_01',
    'SCHEDULED',
    '2026-11-20'
  );

  const insertCommMember = db.prepare(`
    INSERT OR REPLACE INTO evc_committee_members (id, committee_id, user_id, member_role)
    VALUES (?, ?, ?, ?)
  `);

  // Assigned to Delhi Committee
  insertCommMember.run('cm_01', 'evc_comm_01', 'usr_evc_member_01', 'EXPERT_MEMBER');
  insertCommMember.run('cm_02', 'evc_comm_01', 'usr_evc_coord_01', 'COORDINATOR');

  // Assigned to Mumbai Committee
  insertCommMember.run('cm_03', 'evc_comm_02', 'usr_evc_member_02', 'EXPERT_MEMBER');

  // 5. Create real dummy PDF/text files in uploads directory
  const sampleLandContent = Buffer.from(
    '%PDF-1.4\n% AICTE Official Title Deed: Land Area 5.2 Acres at Khasra No. 942/1, Delhi\nVerified registered deed in favor of Delhi Institute of Technology.\n%%EOF'
  );
  const sampleBuildingContent = Buffer.from(
    '%PDF-1.4\n% AICTE Approved Building Plan: Built-up Area 12,500 sq.m.\nMunicipal Corporation Sanctioned Drawing Ref: MCD/BP/2024/8812\n%%EOF'
  );
  const sampleInternalNote = Buffer.from(
    'CONFIDENTIAL AICTE SCRUTINY NOTE: Scrutiny Officer verified Land Deed. Boundary wall survey report requires clarification during physical EVC inspection.'
  );
  const sampleCommitteeReport = Buffer.from(
    'EVC COMMITTEE RESTRICTED OBSERVATION: Lab equipment count and fire safety NOC inspection scheduled for November 10, 2026.'
  );

  const sampleLandPath = path.join(uploadsDir, 'Land_Title_Deed_Khasra_942.pdf');
  const sampleBuildingPath = path.join(uploadsDir, 'Building_Sanction_Plan.pdf');
  const sampleNotePath = path.join(uploadsDir, 'Internal_Scrutiny_Evaluation.txt');
  const sampleEvcPath = path.join(uploadsDir, 'EVC_Preliminary_Inspection_Brief.txt');

  fs.writeFileSync(sampleLandPath, sampleLandContent);
  fs.writeFileSync(sampleBuildingPath, sampleBuildingContent);
  fs.writeFileSync(sampleNotePath, sampleInternalNote);
  fs.writeFileSync(sampleEvcPath, sampleCommitteeReport);

  // 6. Seed Documents
  const insertDoc = db.prepare(`
    INSERT OR REPLACE INTO documents (
      id, document_number, title, file_name, file_path, file_size, file_type, checksum_sha256,
      institution_id, application_id, document_category, folder_category,
      uploader_id, uploader_name, uploader_role, upload_timestamp,
      verification_status, verified_by, verified_at, verification_remarks,
      confidentiality_classification, allowed_roles, allowed_users,
      expiry_date, document_version, retention_status, is_latest_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Document 1: Land Ownership Title Deed (Institution A)
  insertDoc.run(
    'doc_delhi_land_001',
    'DOC-2026-DEL-LAND-001',
    'Land Ownership Title Deed (Khasra 942)',
    'Land_Title_Deed_Khasra_942.pdf',
    sampleLandPath,
    sampleLandContent.length,
    'application/pdf',
    'a9f8b4e723cd8192a54b3211ef6543219876543210abcdef1234567890abcdef',
    'inst_delhi_001',
    'app_2026_del_01',
    'LAND',
    'APPLICATION',
    'usr_inst_admin_delhi',
    'Dr. Arvind Verma (Institution A Admin)',
    ROLES.INSTITUTION_ADMIN,
    '2026-10-15 11:00:00',
    'PENDING',
    null,
    null,
    null,
    VISIBILITY_CATEGORIES.INSTITUTION_VISIBLE,
    null,
    null,
    '2045-12-31',
    1,
    'ACTIVE',
    1
  );

  // Document 2: Building Sanction Plan (Institution A)
  insertDoc.run(
    'doc_delhi_bldg_002',
    'DOC-2026-DEL-BLDG-002',
    'Sanctioned Master Building Plan & Fire Safety NOC',
    'Building_Sanction_Plan.pdf',
    sampleBuildingPath,
    sampleBuildingContent.length,
    'application/pdf',
    'c7d2e3f4567890abcdef1234567890abcdef1234567890abcdef1234567890abcd',
    'inst_delhi_001',
    'app_2026_del_01',
    'BUILDING',
    'APPLICATION',
    'usr_inst_staff_delhi',
    'Sri Ramesh Narayan (Institution A Staff)',
    ROLES.INSTITUTION_STAFF,
    '2026-10-15 11:30:00',
    'VERIFIED',
    'usr_scrutiny_01',
    '2026-10-18 14:00:00',
    'Verified against local Municipal Corporation registration portal.',
    VISIBILITY_CATEGORIES.INSTITUTION_VISIBLE,
    null,
    null,
    '2028-06-30',
    1,
    'ACTIVE',
    1
  );

  // Document 3: Internal Scrutiny Confidential Checklist (AICTE Internal only)
  insertDoc.run(
    'doc_delhi_internal_003',
    'DOC-2026-AICTE-INT-003',
    'Internal AICTE Scrutiny Officer Verification Matrix',
    'Internal_Scrutiny_Evaluation.txt',
    sampleNotePath,
    sampleInternalNote.length,
    'text/plain',
    'e5f6a7b8901234567890abcdef1234567890abcdef1234567890abcdef12345678',
    'inst_delhi_001',
    'app_2026_del_01',
    'COMPLIANCE',
    'COMPLIANCE',
    'usr_scrutiny_01',
    'Dr. R. K. Sharma (Scrutiny Officer)',
    ROLES.SCRUTINY_OFFICER,
    '2026-10-18 15:00:00',
    'VERIFIED',
    'usr_scrutiny_01',
    '2026-10-18 15:00:00',
    'Internal assessment verified.',
    VISIBILITY_CATEGORIES.INTERNAL_AICTE, // Hidden from Institution!
    null,
    null,
    null,
    1,
    'ACTIVE',
    1
  );

  // Document 4: EVC Inspection Committee Report (Committee Restricted)
  insertDoc.run(
    'doc_delhi_evc_004',
    'DOC-2026-EVC-COMM-004',
    'EVC Committee Inspection Report & GPS Geospatial Survey',
    'EVC_Preliminary_Inspection_Brief.txt',
    sampleEvcPath,
    sampleCommitteeReport.length,
    'text/plain',
    'f1e2d3c4b5a6978811223344556677889900aabbccddeeff0011223344556677',
    'inst_delhi_001',
    'app_2026_del_01',
    'EVC_REPORT',
    'COMMITTEE_INSPECTION',
    'usr_evc_coord_01',
    'Prof. Anjali Mathur (EVC Coordinator)',
    ROLES.EVC_COORDINATOR,
    '2026-10-19 16:30:00',
    'PENDING',
    null,
    null,
    null,
    VISIBILITY_CATEGORIES.COMMITTEE_RESTRICTED, // Restricted to EVC committee!
    null,
    null,
    null,
    1,
    'ACTIVE',
    1
  );

  // Seed Document Versions for Doc 1
  const insertVersion = db.prepare(`
    INSERT OR REPLACE INTO document_versions (id, document_id, version, file_name, file_path, file_size, checksum_sha256, uploaded_by, uploaded_by_name, change_summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertVersion.run(
    'ver_001_1',
    'doc_delhi_land_001',
    1,
    'Land_Title_Deed_Khasra_942.pdf',
    sampleLandPath,
    sampleLandContent.length,
    'a9f8b4e723cd8192a54b3211ef6543219876543210abcdef1234567890abcdef',
    'usr_inst_admin_delhi',
    'Dr. Arvind Verma',
    'Initial upload of original Land Deed registered at Sub-Registrar Office, Mehrauli'
  );

  // 7. Seed Multi-Channel Comments (Section E)
  const insertComment = db.prepare(`
    INSERT OR REPLACE INTO comments (
      id, document_id, application_id, institution_id, channel,
      author_id, author_name, author_role, comment_text, is_released_to_institution, released_by, released_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Channel: INSTITUTION_VISIBLE
  insertComment.run(
    'cmt_01',
    'doc_delhi_land_001',
    'app_2026_del_01',
    'inst_delhi_001',
    'INSTITUTION_VISIBLE',
    'usr_inst_admin_delhi',
    'Dr. Arvind Verma',
    ROLES.INSTITUTION_ADMIN,
    'We have uploaded the clear title deed for 5.2 contiguous acres in revenue estate of Mehrauli.',
    1,
    null,
    null
  );

  // Channel: INTERNAL_AICTE (Not released - must be hidden from Institution!)
  insertComment.run(
    'cmt_02',
    'doc_delhi_land_001',
    'app_2026_del_01',
    'inst_delhi_001',
    'INTERNAL_AICTE',
    'usr_scrutiny_01',
    'Dr. R. K. Sharma (Scrutiny Officer)',
    ROLES.SCRUTINY_OFFICER,
    'INTERNAL AICTE EVALUATION: Title deed appears prima facie clear, but ensure conversion order certificate is cross-checked during physical inspection.',
    0, // NOT RELEASED
    null,
    null
  );

  // Channel: COMMITTEE_RESTRICTED
  insertComment.run(
    'cmt_03',
    'doc_delhi_evc_004',
    'app_2026_del_01',
    'inst_delhi_001',
    'COMMITTEE_RESTRICTED',
    'usr_evc_member_01',
    'Dr. Vikramaditya Sen (Assigned EVC Member)',
    ROLES.EVC_MEMBER,
    'EVC Observation: Inspection itinerary planned for November 10th. Geo-tagged photographs of labs and workshops required.',
    0,
    null,
    null
  );

  // Channel: COMPETENT_AUTHORITY
  insertComment.run(
    'cmt_04',
    null,
    'app_2026_del_01',
    'inst_delhi_001',
    'COMPETENT_AUTHORITY',
    'usr_competent_01',
    'Competent Authority',
    ROLES.COMPETENT_AUTHORITY,
    'Noted for fast-track processing under Category-1 accreditation exemption if NAAC score > 3.5.',
    0,
    null,
    null
  );

  // 8. Record Genesis Document Audit Trails (Section G)
  recordDocumentAudit({
    documentId: 'doc_delhi_land_001',
    institutionId: 'inst_delhi_001',
    applicationId: 'app_2026_del_01',
    action: 'UPLOAD',
    performedById: 'usr_inst_admin_delhi',
    performedByName: 'Dr. Arvind Verma',
    performedByRole: ROLES.INSTITUTION_ADMIN,
    details: {
      fileName: 'Land_Title_Deed_Khasra_942.pdf',
      category: 'LAND',
      version: 1,
      classification: VISIBILITY_CATEGORIES.INSTITUTION_VISIBLE
    }
  });

  recordDocumentAudit({
    documentId: 'doc_delhi_land_001',
    institutionId: 'inst_delhi_001',
    applicationId: 'app_2026_del_01',
    action: 'VIEW',
    performedById: 'usr_scrutiny_01',
    performedByName: 'Dr. R. K. Sharma',
    performedByRole: ROLES.SCRUTINY_OFFICER,
    details: { purpose: 'Preliminary Scrutiny Evaluation' }
  });

  console.log('AICTE test environment seeded successfully with 15 users, 3 institutions, 2 applications, 4 documents, and immutable audit logs.');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
