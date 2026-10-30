const { db } = require('./db');

// All 13 system roles
const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  AICTE_ADMIN: 'AICTE_ADMIN',
  REGULATION_BUREAU: 'REGULATION_BUREAU',
  REGIONAL_OFFICER: 'REGIONAL_OFFICER',
  BUREAU_OFFICER: 'BUREAU_OFFICER',
  SCRUTINY_OFFICER: 'SCRUTINY_OFFICER',
  EVC_COORDINATOR: 'EVC_COORDINATOR',
  EVC_MEMBER: 'EVC_MEMBER',
  SAC_SHC_MEMBER: 'SAC_SHC_MEMBER',
  COMPETENT_AUTHORITY: 'COMPETENT_AUTHORITY',
  INSTITUTION_ADMIN: 'INSTITUTION_ADMIN',
  INSTITUTION_STAFF: 'INSTITUTION_STAFF',
  AUDITOR: 'AUDITOR'
};

// All 13 core platform permissions
const PERMISSIONS = {
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  EDIT: 'EDIT',
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD',
  DELETE: 'DELETE',
  VERIFY: 'VERIFY',
  RETURN: 'RETURN',
  ASSIGN: 'ASSIGN',
  REASSIGN: 'REASSIGN',
  APPROVE_REJECT: 'APPROVE_REJECT',
  EXPORT: 'EXPORT',
  CONFIGURE: 'CONFIGURE'
};

// Document-specific permissions
const DOC_PERMISSIONS = {
  PREVIEW: 'PREVIEW',
  VIEW: 'VIEW',
  DOWNLOAD: 'DOWNLOAD',
  UPLOAD: 'UPLOAD',
  REPLACE: 'REPLACE',
  VERIFY: 'VERIFY',
  COMMENT: 'COMMENT',
  SHARE: 'SHARE',
  CHANGE_VISIBILITY: 'CHANGE_VISIBILITY',
  VIEW_VERSION_HISTORY: 'VIEW_VERSION_HISTORY',
  DELETE: 'DELETE'
};

// Configurable Document Visibility Categories (Section C)
const VISIBILITY_CATEGORIES = {
  INSTITUTION_VISIBLE: 'INSTITUTION_VISIBLE',
  INTERNAL_AICTE: 'INTERNAL_AICTE',
  COMMITTEE_RESTRICTED: 'COMMITTEE_RESTRICTED',
  HIGHLY_RESTRICTED: 'HIGHLY_RESTRICTED'
};

// Default role-permission mapping matrix
const DEFAULT_ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: [
    PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.EDIT, PERMISSIONS.UPLOAD,
    PERMISSIONS.DOWNLOAD, PERMISSIONS.DELETE, PERMISSIONS.VERIFY, PERMISSIONS.RETURN,
    PERMISSIONS.ASSIGN, PERMISSIONS.REASSIGN, PERMISSIONS.APPROVE_REJECT,
    PERMISSIONS.EXPORT, PERMISSIONS.CONFIGURE
  ],
  [ROLES.AICTE_ADMIN]: [
    PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.EDIT, PERMISSIONS.UPLOAD,
    PERMISSIONS.DOWNLOAD, PERMISSIONS.DELETE, PERMISSIONS.VERIFY, PERMISSIONS.RETURN,
    PERMISSIONS.ASSIGN, PERMISSIONS.REASSIGN, PERMISSIONS.EXPORT, PERMISSIONS.CONFIGURE
  ],
  [ROLES.REGULATION_BUREAU]: [
    PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.EDIT, PERMISSIONS.UPLOAD,
    PERMISSIONS.DOWNLOAD, PERMISSIONS.VERIFY, PERMISSIONS.RETURN, PERMISSIONS.EXPORT,
    PERMISSIONS.CONFIGURE
  ],
  [ROLES.REGIONAL_OFFICER]: [
    PERMISSIONS.VIEW, PERMISSIONS.EDIT, PERMISSIONS.UPLOAD, PERMISSIONS.DOWNLOAD,
    PERMISSIONS.VERIFY, PERMISSIONS.RETURN, PERMISSIONS.ASSIGN, PERMISSIONS.REASSIGN,
    PERMISSIONS.EXPORT
  ],
  [ROLES.BUREAU_OFFICER]: [
    PERMISSIONS.VIEW, PERMISSIONS.EDIT, PERMISSIONS.UPLOAD, PERMISSIONS.DOWNLOAD,
    PERMISSIONS.VERIFY, PERMISSIONS.RETURN, PERMISSIONS.ASSIGN, PERMISSIONS.EXPORT
  ],
  [ROLES.SCRUTINY_OFFICER]: [
    PERMISSIONS.VIEW, PERMISSIONS.DOWNLOAD, PERMISSIONS.VERIFY, PERMISSIONS.RETURN,
    PERMISSIONS.EXPORT
  ],
  [ROLES.EVC_COORDINATOR]: [
    PERMISSIONS.VIEW, PERMISSIONS.DOWNLOAD, PERMISSIONS.UPLOAD, PERMISSIONS.VERIFY,
    PERMISSIONS.ASSIGN, PERMISSIONS.EXPORT
  ],
  [ROLES.EVC_MEMBER]: [
    PERMISSIONS.VIEW, PERMISSIONS.DOWNLOAD, PERMISSIONS.UPLOAD, PERMISSIONS.EXPORT
  ],
  [ROLES.SAC_SHC_MEMBER]: [
    PERMISSIONS.VIEW, PERMISSIONS.DOWNLOAD, PERMISSIONS.EXPORT
  ],
  [ROLES.COMPETENT_AUTHORITY]: [
    PERMISSIONS.VIEW, PERMISSIONS.DOWNLOAD, PERMISSIONS.APPROVE_REJECT, PERMISSIONS.EXPORT
  ],
  [ROLES.INSTITUTION_ADMIN]: [
    PERMISSIONS.VIEW, PERMISSIONS.CREATE, PERMISSIONS.EDIT, PERMISSIONS.UPLOAD,
    PERMISSIONS.DOWNLOAD, PERMISSIONS.EXPORT
  ],
  [ROLES.INSTITUTION_STAFF]: [
    PERMISSIONS.VIEW, PERMISSIONS.UPLOAD, PERMISSIONS.DOWNLOAD
  ],
  [ROLES.AUDITOR]: [
    // Read-only user: cannot create, edit, upload, delete or modify anything!
    PERMISSIONS.VIEW, PERMISSIONS.DOWNLOAD, PERMISSIONS.EXPORT
  ]
};

/**
 * Initializes default role permissions in DB if not present
 */
function seedRolePermissions() {
  const count = db.prepare('SELECT count(*) as cnt FROM role_permissions').get().cnt;
  if (count === 0) {
    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO role_permissions (id, role, permission, is_allowed)
      VALUES (?, ?, ?, ?)
    `);

    Object.entries(DEFAULT_ROLE_PERMISSIONS).forEach(([role, permissions]) => {
      Object.values(PERMISSIONS).forEach(perm => {
        const isAllowed = permissions.includes(perm) ? 1 : 0;
        insertStmt.run(`${role}_${perm}`, role, perm, isAllowed);
      });
    });
    console.log('Seeded default role permissions matrix.');
  }

  // Seed default visibility classifications if missing
  const visCount = db.prepare('SELECT count(*) as cnt FROM visibility_classifications').get().cnt;
  if (visCount === 0) {
    const insertVis = db.prepare(`
      INSERT INTO visibility_classifications (code, label, description, default_allowed_roles, is_system)
      VALUES (?, ?, ?, ?, 1)
    `);

    insertVis.run(
      VISIBILITY_CATEGORIES.INSTITUTION_VISIBLE,
      'Institution Visible',
      'Documents accessible to the submitting institution and all AICTE processing officers',
      JSON.stringify([
        ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGULATION_BUREAU, ROLES.REGIONAL_OFFICER,
        ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER, ROLES.EVC_COORDINATOR, ROLES.EVC_MEMBER,
        ROLES.SAC_SHC_MEMBER, ROLES.COMPETENT_AUTHORITY, ROLES.INSTITUTION_ADMIN,
        ROLES.INSTITUTION_STAFF, ROLES.AUDITOR
      ])
    );

    insertVis.run(
      VISIBILITY_CATEGORIES.INTERNAL_AICTE,
      'Internal AICTE Only',
      'Restricted to AICTE staff and officers. Completely hidden from institutions.',
      JSON.stringify([
        ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGULATION_BUREAU, ROLES.REGIONAL_OFFICER,
        ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER, ROLES.EVC_COORDINATOR,
        ROLES.SAC_SHC_MEMBER, ROLES.COMPETENT_AUTHORITY, ROLES.AUDITOR
      ])
    );

    insertVis.run(
      VISIBILITY_CATEGORIES.COMMITTEE_RESTRICTED,
      'Committee Restricted',
      'Restricted strictly to appointed EVC committee members and designated coordinators',
      JSON.stringify([
        ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER,
        ROLES.EVC_COORDINATOR, ROLES.EVC_MEMBER, ROLES.COMPETENT_AUTHORITY, ROLES.AUDITOR
      ])
    );

    insertVis.run(
      VISIBILITY_CATEGORIES.HIGHLY_RESTRICTED,
      'Highly Restricted',
      'Sensitive vigilance, legal, or integrity reports accessible only to Competent Authority & Administrators',
      JSON.stringify([
        ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.COMPETENT_AUTHORITY, ROLES.AUDITOR
      ])
    );

    console.log('Seeded visibility classifications.');
  }
}

seedRolePermissions();

/**
 * Checks if a user has a specific core permission, taking into account:
 * 1. Individual User Permission Overrides (highest precedence)
 * 2. Role-based Permission Configuration from DB
 */
function hasPermission(user, permission) {
  if (!user || !user.role) return false;

  // 1. Check individual user override
  const override = db.prepare(`
    SELECT is_granted FROM user_permission_overrides 
    WHERE user_id = ? AND permission = ?
  `).get(user.id, permission);

  if (override !== undefined) {
    return override.is_granted === 1;
  }

  // 2. Check role permission from database
  const rolePerm = db.prepare(`
    SELECT is_allowed FROM role_permissions 
    WHERE role = ? AND permission = ?
  `).get(user.role, permission);

  if (rolePerm !== undefined) {
    return rolePerm.is_allowed === 1;
  }

  // 3. Fallback to hardcoded default
  const defaultList = DEFAULT_ROLE_PERMISSIONS[user.role] || [];
  return defaultList.includes(permission);
}

/**
 * Evaluates tenant / scope isolation between the requesting user and a resource.
 * Enforces institution-level, region-level, application-level, and assignment-level isolation.
 */
function evaluateDataIsolation(user, resource) {
  // Super admin and AICTE Admin have broad administrative access (subject to audit)
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.AICTE_ADMIN) {
    return { allowed: true };
  }

  // Auditor has read-only access across regions/institutions for compliance checking
  if (user.role === ROLES.AUDITOR) {
    return { allowed: true };
  }

  // 1. Institution-level isolation
  if (user.role === ROLES.INSTITUTION_ADMIN || user.role === ROLES.INSTITUTION_STAFF) {
    if (!user.institution_id || !resource.institution_id) {
      return { allowed: false, reason: 'Institution ID missing for tenant check' };
    }
    if (user.institution_id !== resource.institution_id) {
      return { 
        allowed: false, 
        reason: `Cross-tenant violation: User belongs to ${user.institution_id} but resource belongs to ${resource.institution_id}` 
      };
    }
    return { allowed: true };
  }

  // 2. Region-level isolation for Regional Officers
  if (user.role === ROLES.REGIONAL_OFFICER) {
    if (resource.region && user.region && resource.region !== user.region) {
      return { 
        allowed: false, 
        reason: `Regional violation: Officer is assigned to ${user.region} but resource is in ${resource.region}` 
      };
    }
  }

  // 3. Assignment-level isolation for Scrutiny Officer
  if (user.role === ROLES.SCRUTINY_OFFICER) {
    if (resource.application_id) {
      const app = db.prepare('SELECT assigned_scrutiny_officer_id FROM applications WHERE id = ?').get(resource.application_id);
      if (app && app.assigned_scrutiny_officer_id && app.assigned_scrutiny_officer_id !== user.id) {
        return { 
          allowed: false, 
          reason: `Assignment violation: Scrutiny Officer ${user.id} is not assigned to application ${resource.application_id}` 
        };
      }
    }
  }

  // 4. Assignment-level isolation for EVC Member
  if (user.role === ROLES.EVC_MEMBER) {
    if (resource.application_id) {
      // Check if user is a member of the committee assigned to this application
      const isMember = db.prepare(`
        SELECT count(*) as count 
        FROM evc_committee_members cm
        JOIN evc_committees c ON cm.committee_id = c.id
        WHERE cm.user_id = ? AND c.application_id = ?
      `).get(user.id, resource.application_id);

      if (!isMember || isMember.count === 0) {
        return { 
          allowed: false, 
          reason: `Assignment violation: EVC Member ${user.id} is not assigned to application committee` 
        };
      }
    }
  }

  return { allowed: true };
}

module.exports = {
  ROLES,
  PERMISSIONS,
  DOC_PERMISSIONS,
  VISIBILITY_CATEGORIES,
  DEFAULT_ROLE_PERMISSIONS,
  hasPermission,
  evaluateDataIsolation
};
