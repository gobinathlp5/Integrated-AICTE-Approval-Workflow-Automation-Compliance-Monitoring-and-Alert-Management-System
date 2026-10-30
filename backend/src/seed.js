const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { db, uploadsDir } = require('./db');
const { ROLES, VISIBILITY_CATEGORIES } = require('./rbac');
const { recordDocumentAudit } = require('./audit');

function seedDatabase() {
  console.log('Seeding AICTE Digital Governance environment...');

  const defaultPasswordHash = bcrypt.hashSync('Password@123', 10);

  // 1. Seed Institutions with complete profile data
  const insertInst = db.prepare(`
    INSERT OR REPLACE INTO institutions (
      id, code, name, type, region, state, city, district, pincode, address,
      contact_email, contact_phone, hoi_name, hoi_designation, establishment_year,
      programmes_json, compliance_score, status, verified_by_officer_id, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInst.run(
    'inst_delhi_001',
    '1-1002345671',
    'Delhi Institute of Technology & Advanced Science',
    'Engineering & Technology',
    'Northern',
    'Delhi',
    'New Delhi',
    'South West Delhi',
    '110070',
    'Sector 4, Vasant Kunj, Institutional Area, New Delhi',
    'director@dit-delhi.ac.in',
    '+91-11-26892345',
    'Dr. Arvind Verma',
    'Principal & Director',
    2004,
    JSON.stringify([
      { name: 'Computer Science & Engineering', level: 'UG', intake: 180, nba_accredited: true },
      { name: 'Electronics & Communication Engg', level: 'UG', intake: 120, nba_accredited: true },
      { name: 'Artificial Intelligence & Machine Learning', level: 'UG', intake: 60, nba_accredited: false },
      { name: 'Master of Business Administration (MBA)', level: 'PG', intake: 60, nba_accredited: true }
    ]),
    92.5,
    'ACTIVE',
    'usr_regional_north_01',
    '2026-01-15 11:30:00'
  );

  insertInst.run(
    'inst_mumbai_002',
    '1-2009876542',
    'Mumbai College of Engineering & Research (Institution B)',
    'Engineering & Technology',
    'Western',
    'Maharashtra',
    'Mumbai',
    'Mumbai Suburban',
    '400076',
    'Powai Valley Campus, Saki Vihar Road, Mumbai',
    'principal@mumbai-engg.edu.in',
    '+91-22-28574921',
    'Dr. Suresh Patil',
    'Director & Professor',
    2012,
    JSON.stringify([
      { name: 'Information Technology', level: 'UG', intake: 120, nba_accredited: false },
      { name: 'Mechanical Engineering', level: 'UG', intake: 60, nba_accredited: false }
    ]),
    78.0,
    'ACTIVE',
    null,
    null
  );

  insertInst.run(
    'inst_blr_003',
    '1-3004567893',
    'Bengaluru National Institute of Technology',
    'Engineering & Technology',
    'South-Western',
    'Karnataka',
    'Bengaluru',
    'Bengaluru Urban',
    '560001',
    'Electronic City Phase 1, Hosur Road, Bengaluru',
    'director@bnit.ac.in',
    '+91-80-28520111',
    'Dr. K. S. Rajan',
    'Dean & Principal',
    1998,
    JSON.stringify([
      { name: 'Computer Science & Engineering', level: 'UG', intake: 240, nba_accredited: true },
      { name: 'Data Science', level: 'UG', intake: 120, nba_accredited: true }
    ]),
    96.0,
    'ACTIVE',
    'usr_super_01',
    '2026-02-10 10:00:00'
  );

  // 2. Seed Users across all 13 Roles
  const insertUser = db.prepare(`
    INSERT OR REPLACE INTO users (
      id, username, email, password_hash, full_name, role, institution_id, region, designation, is_active, mfa_enabled, mfa_secret
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demoUsers = [
    { id: 'usr_super_01', username: 'superadmin', email: 'superadmin@aicte-india.org', fullName: 'Dr. T. G. Sitharam', role: ROLES.SUPER_ADMIN, instId: null, region: 'Central HQ', designation: 'Chief Platform Administrator' },
    { id: 'usr_aicte_admin_01', username: 'aicteadmin', email: 'aicteadmin@aicte-india.org', fullName: 'Shri Manoj Kumar', role: ROLES.AICTE_ADMIN, instId: null, region: 'Central HQ', designation: 'Director, e-Governance Cell' },
    { id: 'usr_reg_bureau_01', username: 'regbureau', email: 'regulation@aicte-india.org', fullName: 'Prof. Rajive Kumar', role: ROLES.REGULATION_BUREAU, instId: null, region: 'Central HQ', designation: 'Member Secretary & Bureau Head' },
    { id: 'usr_regional_north_01', username: 'regionalofficer', email: 'ro.north@aicte-india.org', fullName: 'Dr. Sunil K. Luthra', role: ROLES.REGIONAL_OFFICER, instId: null, region: 'Northern', designation: 'Regional Officer (North)' },
    { id: 'usr_bureau_01', username: 'bureauofficer', email: 'approval.bureau@aicte-india.org', fullName: 'Smt. Vandana Sharma', role: ROLES.BUREAU_OFFICER, instId: null, region: 'Northern', designation: 'Joint Director (Approval Bureau)' },
    { id: 'usr_scrutiny_01', username: 'scrutinyofficer', email: 'scrutiny.sharma@aicte-india.org', fullName: 'Dr. R. K. Sharma', role: ROLES.SCRUTINY_OFFICER, instId: null, region: 'Northern', designation: 'Senior Scrutiny Evaluator' },
    { id: 'usr_evc_coord_01', username: 'evccoordinator', email: 'evc.coord@aicte-india.org', fullName: 'Prof. Anjali Mathur', role: ROLES.EVC_COORDINATOR, instId: null, region: 'Northern', designation: 'EVC Regional Inspection Coordinator' },
    { id: 'usr_evc_member_01', username: 'evcmember', email: 'evc.member.delhi@aicte-india.org', fullName: 'Dr. Vikramaditya Sen', role: ROLES.EVC_MEMBER, instId: null, region: 'Northern', designation: 'Expert Committee Inspector (Delhi Panel)' },
    { id: 'usr_evc_member_02', username: 'evcmember2', email: 'evc.member.west@aicte-india.org', fullName: 'Dr. Ramesh Joshi', role: ROLES.EVC_MEMBER, instId: null, region: 'Western', designation: 'Expert Committee Inspector (Mumbai Panel)' },
    { id: 'usr_sac_01', username: 'sacmember', email: 'sac.committee@aicte-india.org', fullName: 'Prof. D. K. Murthy', role: ROLES.SAC_SHC_MEMBER, instId: null, region: 'Central HQ', designation: 'Standing Appellate Committee Jurist' },
    { id: 'usr_competent_01', username: 'competentauthority', email: 'chairman@aicte-india.org', fullName: 'Competent Appellate Authority', role: ROLES.COMPETENT_AUTHORITY, instId: null, region: 'Central HQ', designation: 'Competent Decision Authority' },
    { id: 'usr_inst_admin_delhi', username: 'instadmin', email: 'director@dit-delhi.ac.in', fullName: 'Dr. Arvind Verma', role: ROLES.INSTITUTION_ADMIN, instId: 'inst_delhi_001', region: 'Northern', designation: 'Principal & Director' },
    { id: 'usr_inst_staff_delhi', username: 'inststaff', email: 'registrar@dit-delhi.ac.in', fullName: 'Sri Ramesh Narayan', role: ROLES.INSTITUTION_STAFF, instId: 'inst_delhi_001', region: 'Northern', designation: 'Registrar & Compliance Head' },
    { id: 'usr_inst_admin_mumbai', username: 'instadmin_b', email: 'principal@mumbai-engg.edu.in', fullName: 'Dr. Suresh Patil', role: ROLES.INSTITUTION_ADMIN, instId: 'inst_mumbai_002', region: 'Western', designation: 'Director (Mumbai College)' },
    { id: 'usr_auditor_01', username: 'auditor', email: 'cag.auditor@cag.gov.in', fullName: 'Shri Alok K. Jain', role: ROLES.AUDITOR, instId: null, region: 'Central HQ', designation: 'Principal Statutory Auditor (Read-Only)' }
  ];

  demoUsers.forEach(u => {
    insertUser.run(u.id, u.username, u.email, defaultPasswordHash, u.fullName, u.role, u.instId, u.region, u.designation, 1, 0, '123456');
  });

  // 3. Seed Configurable Workflow Templates (Section 3.6)
  const insertWf = db.prepare(`
    INSERT OR REPLACE INTO workflow_templates (id, code, name, description, application_category, stages_json, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertWf.run(
    'wf_standard_full',
    'WF_STANDARD_FULL',
    'Comprehensive 4-Stage Scrutiny + EVC + SAC Workflow',
    'Standard statutory approval pathway for new institutes or major expansion in technical intake',
    'EXTENSION_OF_APPROVAL',
    JSON.stringify([
      { stage: 'DRAFT', name: 'Draft Preparation', requiredRole: 'INSTITUTION_ADMIN', prerequisites: [] },
      { stage: 'SUBMITTED', name: 'Submitted & Queued', requiredRole: 'INSTITUTION_ADMIN', prerequisites: ['DRAFT'] },
      { stage: 'UNDER_SCRUTINY', name: 'Document Scrutiny Review', requiredRole: 'SCRUTINY_OFFICER', prerequisites: ['SUBMITTED'] },
      { stage: 'SCRUTINY_DEFICIENT', name: 'Deficiencies Raised', requiredRole: 'INSTITUTION_ADMIN', prerequisites: ['UNDER_SCRUTINY'] },
      { stage: 'UNDER_EVC', name: 'Expert Visiting Committee Inspection', requiredRole: 'EVC_COORDINATOR', prerequisites: ['UNDER_SCRUTINY'] },
      { stage: 'EVC_COMPLETED', name: 'EVC Inspection Report Submitted', requiredRole: 'EVC_MEMBER', prerequisites: ['UNDER_EVC'] },
      { stage: 'UNDER_SAC', name: 'Standing Hearing / Appellate Committee', requiredRole: 'SAC_SHC_MEMBER', prerequisites: ['EVC_COMPLETED'] },
      { stage: 'COMPETENT_AUTHORITY_REVIEW', name: 'Final Statutory Decision', requiredRole: 'COMPETENT_AUTHORITY', prerequisites: ['EVC_COMPLETED'] },
      { stage: 'APPROVED', name: 'Approval Granted (EoA Issued)', requiredRole: 'COMPETENT_AUTHORITY', prerequisites: ['COMPETENT_AUTHORITY_REVIEW'] },
      { stage: 'REJECTED', name: 'Application Rejected', requiredRole: 'COMPETENT_AUTHORITY', prerequisites: ['COMPETENT_AUTHORITY_REVIEW'] }
    ]),
    1
  );

  insertWf.run(
    'wf_scrutiny_only',
    'WF_SCRUTINY_ONLY',
    'Fast-Track Scrutiny Only Workflow',
    'Streamlined approval for routine annual renewals without change in intake',
    'RENEWAL',
    JSON.stringify([
      { stage: 'SUBMITTED', name: 'Submitted', requiredRole: 'INSTITUTION_ADMIN', prerequisites: [] },
      { stage: 'UNDER_SCRUTINY', name: 'Document Scrutiny Review', requiredRole: 'SCRUTINY_OFFICER', prerequisites: ['SUBMITTED'] },
      { stage: 'APPROVED', name: 'Direct Approval Granted', requiredRole: 'COMPETENT_AUTHORITY', prerequisites: ['UNDER_SCRUTINY'] }
    ]),
    1
  );

  // 4. Seed Applications with workflow integration
  const insertApp = db.prepare(`
    INSERT OR REPLACE INTO applications (
      id, application_number, institution_id, academic_year, application_type,
      status, current_stage, workflow_template_id, region, assigned_scrutiny_officer_id,
      assigned_evc_committee_id, is_on_hold, submission_date, remarks, programmes_requested
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertApp.run(
    'app_2026_del_01',
    'AICTE/2026-27/1-1002345671',
    'inst_delhi_001',
    '2026-2027',
    'EXTENSION_OF_APPROVAL',
    'UNDER_SCRUTINY',
    'UNDER_SCRUTINY',
    'wf_standard_full',
    'Northern',
    'usr_scrutiny_01',
    'evc_comm_01',
    0,
    '2026-10-15 10:30:00',
    'Submitted for annual Extension of Approval (EoA) and Increase in Intake for B.Tech CSE (+60 seats).',
    JSON.stringify([
      { programme: 'B.Tech Computer Science & Engineering', currentIntake: 180, proposedIntake: 240, status: 'PROPOSED' },
      { programme: 'B.Tech AI & Data Science', currentIntake: 60, proposedIntake: 60, status: 'CONTINUING' }
    ])
  );

  insertApp.run(
    'app_2026_mum_02',
    'AICTE/2026-27/1-2009876542',
    'inst_mumbai_002',
    '2026-2027',
    'NEW_INSTITUTE',
    'DRAFT',
    'DRAFT',
    'wf_standard_full',
    'Western',
    null,
    'evc_comm_02',
    0,
    '2026-10-20 14:15:00',
    'Application for establishment of New Engineering College in Mumbai outskirts.',
    JSON.stringify([
      { programme: 'B.Tech Information Technology', currentIntake: 0, proposedIntake: 60, status: 'NEW' }
    ])
  );

  // Seed Application Workflow History
  const insertWfHist = db.prepare(`
    INSERT OR REPLACE INTO application_workflow_history (
      id, application_id, from_stage, to_stage, transitioned_by, transitioned_by_role, remarks, prerequisites_verified
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertWfHist.run(
    'wfh_01',
    'app_2026_del_01',
    'DRAFT',
    'SUBMITTED',
    'usr_inst_admin_delhi',
    ROLES.INSTITUTION_ADMIN,
    'Application submitted along with mandatory statutory affidavits.',
    1
  );

  insertWfHist.run(
    'wfh_02',
    'app_2026_del_01',
    'SUBMITTED',
    'UNDER_SCRUTINY',
    'usr_regional_north_01',
    ROLES.REGIONAL_OFFICER,
    'Assigned to Senior Scrutiny Evaluator Dr. R. K. Sharma.',
    1
  );

  // 5. Seed Scrutiny Evaluations & Checklists (Section 3.7)
  const insertScrutiny = db.prepare(`
    INSERT OR REPLACE INTO scrutiny_evaluations (
      id, application_id, officer_id, officer_name, status, checklist_json, overall_remarks, recommendation, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertScrutiny.run(
    'scrut_delhi_01',
    'app_2026_del_01',
    'usr_scrutiny_01',
    'Dr. R. K. Sharma',
    'IN_PROGRESS',
    JSON.stringify([
      { item: 'Land Ownership & Registration (Contiguous 5.2 Acres)', status: 'VERIFIED', remarks: 'Registered title deed verified.' },
      { item: 'Approved Master Building Sanction Plan', status: 'VERIFIED', remarks: 'Sanctioned by Municipal Corp. Built-up area 12,500 sqm meets AICTE norms.' },
      { item: 'Fire Safety NOC Validity', status: 'VERIFIED', remarks: 'Valid through June 2028.' },
      { item: 'Faculty Cadre Ratio (1:15 & 1:2:6)', status: 'DEFICIENT', remarks: 'Shortage of 2 Associate Professors in CSE department.' },
      { item: 'Digital Computing Facilities & 1 Gbps Bandwidth', status: 'VERIFIED', remarks: '620 Core i7 terminals verified.' }
    ]),
    'Primary land and structural criteria verified. Deficiencies raised regarding CSE faculty cadre ratio.',
    'DEFICIENCY_RAISED',
    null
  );

  // Seed Deficiencies
  const insertDeficiency = db.prepare(`
    INSERT OR REPLACE INTO deficiencies (
      id, application_id, document_id, raised_by_id, raised_by_name, raised_by_role,
      title, description, severity, status, institution_response, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertDeficiency.run(
    'def_delhi_01',
    'app_2026_del_01',
    'doc_delhi_land_001',
    'usr_scrutiny_01',
    'Dr. R. K. Sharma',
    ROLES.SCRUTINY_OFFICER,
    'CSE Faculty Cadre Shortfall',
    'Cadre ratio requires 1 Professor, 2 Associate Professors, and 6 Assistant Professors per 60 intake. CSE Department currently lacks 2 Associate Professors.',
    'MAJOR',
    'OPEN',
    'Faculty recruitment drive conducted on Oct 25. Selection committee minutes will be uploaded prior to EVC inspection.',
    null
  );

  // 6. Seed EVC Committees & Inspection Schedules (Section 3.8)
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

  insertCommMember.run('cm_01', 'evc_comm_01', 'usr_evc_member_01', 'EXPERT_MEMBER');
  insertCommMember.run('cm_02', 'evc_comm_01', 'usr_evc_coord_01', 'COORDINATOR');
  insertCommMember.run('cm_03', 'evc_comm_02', 'usr_evc_member_02', 'EXPERT_MEMBER');

  const insertInspection = db.prepare(`
    INSERT OR REPLACE INTO evc_inspections (
      id, committee_id, application_id, scheduled_date, status, agenda, checklist_json, findings, recommendation
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertInspection.run(
    'evc_insp_delhi_01',
    'evc_comm_01',
    'app_2026_del_01',
    '2026-11-10',
    'SCHEDULED',
    '1. Physical verification of boundaries & Khasra No. 942/1\n2. Physical inspection of IoT & Robotics Laboratories\n3. Verification of Fire Safety Sprinklers & Barrier-Free Ramps\n4. Interaction with recruited CSE faculty',
    JSON.stringify([
      { section: 'Boundary Wall & Campus Contiguity', verified: true, remarks: 'Continuous 8ft RCC boundary observed.' },
      { section: 'Hardware & Internet Laboratories', verified: true, remarks: 'Leased line speed test: 980 Mbps.' },
      { section: 'Barrier-Free Physical Accessibility for Divyangjan', verified: true, remarks: 'Lifts and tactile pavers operational.' }
    ]),
    'Preliminary inspection itinerary confirmed with institution director.',
    'RECOMMENDED_APPROVAL'
  );

  // 7. Seed SAC / SHC Hearings (Section 3.9)
  const insertSac = db.prepare(`
    INSERT OR REPLACE INTO sac_committees (id, code, name, type, hearing_date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertSac.run(
    'sac_comm_01',
    'SAC-2026-HQ-008',
    'Standing Appellate Committee Panel 1 (Technical Higher Education)',
    'SAC',
    '2026-11-25',
    'ACTIVE'
  );

  const insertSacHearing = db.prepare(`
    INSERT OR REPLACE INTO sac_hearings (
      id, committee_id, application_id, scheduled_at, appellant_name, hearing_summary, observations, recommendation, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSacHearing.run(
    'sac_h_01',
    'sac_comm_01',
    'app_2026_del_01',
    '2026-11-25 14:00:00',
    'Dr. Arvind Verma (Director, DIT)',
    'Appeal concerning proposed intake increase in Computer Science from 180 to 240 seats.',
    'Appellate bench noted that institution holds NAAC A+ accreditation with CGPA 3.62.',
    'APPROVE_GRANT',
    'SCHEDULED'
  );

  // 8. Seed Undertaking Templates & Submissions (Section 3.11)
  const insertUndertakingTpl = db.prepare(`
    INSERT OR REPLACE INTO undertaking_templates (id, code, title, description, category, is_mandatory, content_template)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUndertakingTpl.run(
    'utpl_ragging',
    'UTPL_ANTI_RAGGING',
    'Mandatory Statutory Undertaking on Anti-Ragging Measures',
    'Statutory compliance under AICTE Regulations 2009 regarding zero tolerance to ragging on campus.',
    'ANTI_RAGGING',
    1,
    'I, the undersigned Principal/Director, hereby solemnly affirm that our institution has constituted Anti-Ragging Committee and Squad as per AICTE statutory guidelines.'
  );

  insertUndertakingTpl.run(
    'utpl_land',
    'UTPL_LAND_CONTIGUITY',
    'Undertaking on Contiguity & Clear Title of Land',
    'Affidavit affirming that campus land is free of all encumbrances and non-agricultural conversion is complete.',
    'LAND_CONTIGUITY',
    1,
    'I solemnly declare that the 5.2 acres of campus land is strictly contiguous and under clear legal possession of the Society/Trust.'
  );

  insertUndertakingTpl.run(
    'utpl_cadre',
    'UTPL_FACULTY_CADRE',
    'Undertaking on Faculty Cadre Ratio & 7th Pay Commission Scale',
    'Statutory affidavit guaranteeing full salary disbursement through nationalized banking channel as per 7th CPC.',
    'FACULTY_CADRE',
    1,
    'The institution hereby undertakes to maintain the 1:15 faculty-student cadre ratio and disburse salaries via digital bank transfers.'
  );

  const insertUndertaking = db.prepare(`
    INSERT OR REPLACE INTO undertakings (
      id, template_id, institution_id, application_id, title, status, document_id, valid_from, valid_until, verification_remarks, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUndertaking.run(
    'ut_delhi_01',
    'utpl_ragging',
    'inst_delhi_001',
    'app_2026_del_01',
    'Anti-Ragging Statutory Undertaking 2026-27',
    'VERIFIED',
    'doc_delhi_land_001',
    '2026-07-01',
    '2027-06-30',
    'Signed on Rs. 100 non-judicial stamp paper and notarized.',
    'usr_scrutiny_01',
    '2026-10-18 11:00:00'
  );

  insertUndertaking.run(
    'ut_delhi_02',
    'utpl_land',
    'inst_delhi_001',
    'app_2026_del_01',
    'Land Title & Contiguity Affidavit',
    'VERIFIED',
    'doc_delhi_land_001',
    '2026-01-01',
    '2036-12-31',
    'Revenue authority boundary certificate authenticated.',
    'usr_scrutiny_01',
    '2026-10-18 11:15:00'
  );

  // 9. Seed Compliance Obligations (Section 3.13)
  const insertComp = db.prepare(`
    INSERT OR REPLACE INTO compliance_obligations (
      id, institution_id, application_id, title, category, description, due_date, status, penalty_clause, compliance_score, verified_by, verified_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertComp.run(
    'comp_delhi_01',
    'inst_delhi_001',
    'app_2026_del_01',
    'Annual Grievance Redressal Mechanism & Committee Filing',
    'REGULATORY',
    'Submission of report of Internal Complaints Committee (ICC) & Ombudsman appointment.',
    '2026-12-31',
    'VERIFIED',
    'Hold on subsequent academic expansion intake',
    100.0,
    'usr_regional_north_01',
    '2026-09-10 14:00:00'
  );

  insertComp.run(
    'comp_delhi_02',
    'inst_delhi_001',
    'app_2026_del_01',
    'Fire Safety & Municipal Building NOC Renewal',
    'INFRASTRUCTURE',
    'Renewal submission of structural stability certificate prior to statutory expiry.',
    '2028-06-30',
    'PENDING',
    'Withdrawal of approval for upper-floor laboratories',
    95.0,
    null,
    null
  );

  insertComp.run(
    'comp_delhi_03',
    'inst_delhi_001',
    'app_2026_del_01',
    'Recruitment Compliance for CSE Associate Professors',
    'FACULTY',
    'Submission of joining reports and qualification verification for 2 CSE Associate Professors.',
    '2026-11-05',
    'PENDING',
    'Reduction in proposed intake from 240 back to 180 seats',
    80.0,
    null,
    null
  );

  // 10. Seed Notifications & Alerts (Section 3.14)
  const insertNotif = db.prepare(`
    INSERT OR REPLACE INTO notifications (
      id, user_id, role_target, institution_id, title, message, type, link, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertNotif.run(
    'notif_01',
    'usr_inst_admin_delhi',
    ROLES.INSTITUTION_ADMIN,
    'inst_delhi_001',
    'Scrutiny Review Initiated',
    'Your application AICTE/2026-27/1-1002345671 is now undergoing scrutiny review by Senior Evaluator Dr. R. K. Sharma.',
    'INFO',
    '/applications',
    0,
    '2026-10-18 10:00:00'
  );

  insertNotif.run(
    'notif_02',
    'usr_inst_admin_delhi',
    ROLES.INSTITUTION_ADMIN,
    'inst_delhi_001',
    'Scrutiny Deficiency Notice Issued',
    'Deficiency raised regarding CSE Faculty Cadre ratio. Please provide compliance clarification prior to physical EVC visit.',
    'DEFICIENCY',
    '/scrutiny',
    0,
    '2026-10-19 14:30:00'
  );

  insertNotif.run(
    'notif_03',
    'usr_scrutiny_01',
    ROLES.SCRUTINY_OFFICER,
    'inst_delhi_001',
    'New Application Assigned for Scrutiny',
    'You have been appointed scrutiny evaluator for Delhi Institute of Technology (App # AICTE/2026-27/1-1002345671).',
    'INFO',
    '/scrutiny',
    1,
    '2026-10-16 09:15:00'
  );

  insertNotif.run(
    'notif_04',
    'usr_regional_north_01',
    ROLES.REGIONAL_OFFICER,
    'inst_delhi_001',
    'EVC Inspection Scheduled',
    'EVC Committee EVC-2026-NORTH-042 inspection set for November 10, 2026 at Delhi Institute of Technology.',
    'INFO',
    '/evc',
    0,
    '2026-10-20 16:00:00'
  );

  // 11. Seed Escalations (Section 3.15)
  const insertEsc = db.prepare(`
    INSERT OR REPLACE INTO escalations (
      id, application_id, institution_id, escalation_level, reason, assigned_to_role, assigned_to_user_id, status, resolution_notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertEsc.run(
    'esc_01',
    'app_2026_del_01',
    'inst_delhi_001',
    'LEVEL_1',
    'Faculty Cadre deficiency response pending verification past 7 days',
    ROLES.REGIONAL_OFFICER,
    'usr_regional_north_01',
    'ACTIVE',
    'Regional Officer instructed Scrutiny Evaluator to schedule hearing on Oct 31.'
  );

  // 12. Seed Physical Dummy Files & Documents Repository
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
    VISIBILITY_CATEGORIES.INTERNAL_AICTE,
    null,
    null,
    null,
    1,
    'ACTIVE',
    1
  );

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
    VISIBILITY_CATEGORIES.COMMITTEE_RESTRICTED,
    null,
    null,
    null,
    1,
    'ACTIVE',
    1
  );

  // 13. Seed Comments & Multi-Channel Remarks
  const insertComment = db.prepare(`
    INSERT OR REPLACE INTO comments (
      id, document_id, application_id, institution_id, channel,
      author_id, author_name, author_role, comment_text, is_released_to_institution, released_by, released_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

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
    0,
    null,
    null
  );

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

  // 14. Record Genesis Document Audit Trails
  recordDocumentAudit({
    documentId: 'doc_delhi_land_001',
    institutionId: 'inst_delhi_001',
    applicationId: 'app_2026_del_01',
    action: 'UPLOAD',
    performedById: 'usr_inst_admin_delhi',
    performedByName: 'Dr. Arvind Verma',
    performedByRole: ROLES.INSTITUTION_ADMIN,
    details: { fileName: 'Land_Title_Deed_Khasra_942.pdf', category: 'LAND', version: 1, classification: VISIBILITY_CATEGORIES.INSTITUTION_VISIBLE }
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

  console.log('AICTE Digital Governance environment seeded successfully with all statutory modules & telemetry.');
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
