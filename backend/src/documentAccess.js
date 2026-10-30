const { db } = require('./db');
const { ROLES, DOC_PERMISSIONS, VISIBILITY_CATEGORIES, evaluateDataIsolation } = require('./rbac');

/**
 * Checks whether a specific user can perform an action on a document.
 * 
 * Enforces:
 * 1. Scope / Tenant isolation (Institution, Region, Assignment)
 * 2. Document Confidentiality Classification rules
 * 3. Specific Allowed Roles or Allowed Users overrides on the document
 * 4. Granular Document Permission rules (Preview, View, Download, Replace, Verify, Delete, etc.)
 * 5. Retention status protection (PURGE_PROTECTED / HOLD cannot be deleted)
 * 6. Role-specific safety barriers (e.g. Scrutiny officers cannot modify/replace an institution's original file; Auditors cannot modify/replace/delete).
 */
function evaluateDocumentAccess(user, document, action) {
  if (!user) {
    return { allowed: false, statusCode: 401, reason: 'Authentication required' };
  }

  if (!document) {
    return { allowed: false, statusCode: 404, reason: 'Document not found' };
  }

  // Auditor role safety barrier: AUDITOR can only PREVIEW, VIEW, DOWNLOAD, VIEW_VERSION_HISTORY
  if (user.role === ROLES.AUDITOR) {
    const readOnlyActions = [
      DOC_PERMISSIONS.PREVIEW,
      DOC_PERMISSIONS.VIEW,
      DOC_PERMISSIONS.DOWNLOAD,
      DOC_PERMISSIONS.VIEW_VERSION_HISTORY
    ];
    if (!readOnlyActions.includes(action)) {
      return { 
        allowed: false, 
        statusCode: 403, 
        reason: `Auditor role is strictly read-only. Action ${action} is prohibited.` 
      };
    }
  }

  // Step 1: Base Data Isolation Check (institution match, region match, assignment match)
  const isolationResult = evaluateDataIsolation(user, {
    institution_id: document.institution_id,
    application_id: document.application_id,
    region: document.region
  });

  if (!isolationResult.allowed) {
    return { 
      allowed: false, 
      statusCode: 403, 
      reason: isolationResult.reason || 'Data isolation violation' 
    };
  }

  // Step 2: Confidentiality Classification Check
  const classification = document.confidentiality_classification;

  // Institution user attempting to access INTERNAL_AICTE, COMMITTEE_RESTRICTED, or HIGHLY_RESTRICTED
  const isInstitutionUser = user.role === ROLES.INSTITUTION_ADMIN || user.role === ROLES.INSTITUTION_STAFF;
  if (isInstitutionUser && classification !== VISIBILITY_CATEGORIES.INSTITUTION_VISIBLE) {
    return { 
      allowed: false, 
      statusCode: 403, 
      reason: `Access Denied: Document classification is [${classification}], which is hidden from institutions.` 
    };
  }

  // EVC Member checking COMMITTEE_RESTRICTED
  if (user.role === ROLES.EVC_MEMBER && classification === VISIBILITY_CATEGORIES.HIGHLY_RESTRICTED) {
    return { 
      allowed: false, 
      statusCode: 403, 
      reason: 'EVC committee members cannot access Highly Restricted documents.' 
    };
  }

  // Scrutiny Officer checking COMMITTEE_RESTRICTED
  if (user.role === ROLES.SCRUTINY_OFFICER && classification === VISIBILITY_CATEGORIES.COMMITTEE_RESTRICTED) {
    return { 
      allowed: false, 
      statusCode: 403, 
      reason: 'Scrutiny officers cannot access Committee Restricted documents.' 
    };
  }

  // Check custom allowed_roles if specified on the document
  if (document.allowed_roles) {
    let allowedRolesList = [];
    try {
      allowedRolesList = typeof document.allowed_roles === 'string' 
        ? JSON.parse(document.allowed_roles) 
        : document.allowed_roles;
    } catch (e) {
      allowedRolesList = [];
    }

    if (allowedRolesList.length > 0 && !allowedRolesList.includes(user.role) && user.role !== ROLES.SUPER_ADMIN) {
      return { 
        allowed: false, 
        statusCode: 403, 
        reason: `Role ${user.role} is not in the document's explicitly allowed roles list.` 
      };
    }
  }

  // Check custom allowed_users if specified on the document
  if (document.allowed_users) {
    let allowedUsersList = [];
    try {
      allowedUsersList = typeof document.allowed_users === 'string' 
        ? JSON.parse(document.allowed_users) 
        : document.allowed_users;
    } catch (e) {
      allowedUsersList = [];
    }

    if (allowedUsersList.length > 0 && !allowedUsersList.includes(user.id) && user.role !== ROLES.SUPER_ADMIN) {
      return { 
        allowed: false, 
        statusCode: 403, 
        reason: `User ${user.id} is not in the document's explicitly allowed user whitelist.` 
      };
    }
  }

  // Step 3: Action-Specific Permission Checks
  switch (action) {
    case DOC_PERMISSIONS.PREVIEW:
    case DOC_PERMISSIONS.VIEW:
    case DOC_PERMISSIONS.VIEW_VERSION_HISTORY:
      return { allowed: true };

    case DOC_PERMISSIONS.DOWNLOAD:
      // Downloading can be restricted based on role or confidentiality
      return { allowed: true };

    case DOC_PERMISSIONS.REPLACE:
      // Mandatory security rule: A scrutiny officer cannot modify the institution's original uploaded file!
      if (user.role === ROLES.SCRUTINY_OFFICER) {
        return { 
          allowed: false, 
          statusCode: 403, 
          reason: 'Security Violation: Scrutiny Officers cannot modify or replace an institution original document.' 
        };
      }
      if (user.role === ROLES.EVC_MEMBER || user.role === ROLES.SAC_SHC_MEMBER) {
        return { 
          allowed: false, 
          statusCode: 403, 
          reason: 'Committee members cannot replace uploaded institution documents.' 
        };
      }
      // Institution user can replace only if document belongs to their institution and status is PENDING or RETURNED
      if (isInstitutionUser) {
        if (document.institution_id !== user.institution_id) {
          return { allowed: false, statusCode: 403, reason: 'Cannot replace document of another institution.' };
        }
        if (document.verification_status === 'VERIFIED') {
          return { allowed: false, statusCode: 403, reason: 'Verified documents are locked against direct replacement.' };
        }
      }
      return { allowed: true };

    case DOC_PERMISSIONS.VERIFY:
      // Only Scrutiny Officer, Regional Officer, Bureau Officer, AICTE Admin, Super Admin, EVC Coordinator can verify
      const canVerifyRoles = [
        ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER,
        ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER, ROLES.EVC_COORDINATOR,
        ROLES.COMPETENT_AUTHORITY
      ];
      if (!canVerifyRoles.includes(user.role)) {
        return { 
          allowed: false, 
          statusCode: 403, 
          reason: `Role ${user.role} is not authorized to verify or return documents.` 
        };
      }
      return { allowed: true };

    case DOC_PERMISSIONS.COMMENT:
      return { allowed: true };

    case DOC_PERMISSIONS.CHANGE_VISIBILITY:
      // Changing visibility classification requires Admin, Regional Officer, Bureau Officer, or Super Admin
      const canChangeVisibilityRoles = [
        ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGIONAL_OFFICER,
        ROLES.BUREAU_OFFICER, ROLES.COMPETENT_AUTHORITY
      ];
      if (!canChangeVisibilityRoles.includes(user.role)) {
        return { 
          allowed: false, 
          statusCode: 403, 
          reason: `Role ${user.role} cannot alter document confidentiality classification.` 
        };
      }
      return { allowed: true };

    case DOC_PERMISSIONS.DELETE:
      // Delete where legally permitted:
      if (document.retention_status === 'HOLD' || document.retention_status === 'PURGE_PROTECTED') {
        return { 
          allowed: false, 
          statusCode: 403, 
          reason: `Document is on legal hold or purge protection (${document.retention_status}) and cannot be deleted.` 
        };
      }
      if (document.verification_status === 'VERIFIED') {
        return { 
          allowed: false, 
          statusCode: 403, 
          reason: 'Verified statutory documents cannot be deleted under AICTE retention policy.' 
        };
      }
      // Only Super Admin or Institution Admin (for unverified draft documents)
      if (user.role === ROLES.SUPER_ADMIN) {
        return { allowed: true };
      }
      if (user.role === ROLES.INSTITUTION_ADMIN && document.institution_id === user.institution_id && document.verification_status === 'PENDING') {
        return { allowed: true };
      }
      return { 
        allowed: false, 
        statusCode: 403, 
        reason: 'Insufficient permissions to delete document.' 
      };

    default:
      return { allowed: false, statusCode: 400, reason: `Unknown document action: ${action}` };
  }
}

module.exports = {
  evaluateDocumentAccess
};
