const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES, PERMISSIONS } = require('../rbac');
const { authenticateToken, sanitizeUser } = require('../auth');

// Middleware to ensure user is Super Admin or AICTE Admin
function requireAdmin(req, res, next) {
  if (req.user.role !== ROLES.SUPER_ADMIN && req.user.role !== ROLES.AICTE_ADMIN) {
    return res.status(403).json({ 
      error: 'Forbidden', 
      message: 'Administrative privileges required to access this resource.' 
    });
  }
  next();
}

/**
 * GET /api/admin/roles-permissions
 * Retrieve all roles, available permissions, and current mappings
 */
router.get('/roles-permissions', authenticateToken, requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM role_permissions').all();
  
  // Format matrix
  const matrix = {};
  rows.forEach(r => {
    if (!matrix[r.role]) matrix[r.role] = {};
    matrix[r.role][r.permission] = r.is_allowed === 1;
  });

  return res.json({
    roles: Object.values(ROLES),
    permissions: Object.values(PERMISSIONS),
    matrix
  });
});

/**
 * PUT /api/admin/roles-permissions
 * Update permission status for a role
 */
router.put('/roles-permissions', authenticateToken, requireAdmin, (req, res) => {
  const { role, permission, isAllowed } = req.body;

  if (!role || !permission || isAllowed === undefined) {
    return res.status(400).json({ error: 'Role, permission, and isAllowed status required.' });
  }

  // Prevent disabling essential permissions for Super Admin
  if (role === ROLES.SUPER_ADMIN && !isAllowed) {
    return res.status(400).json({ error: 'Super Admin permissions cannot be revoked.' });
  }

  const id = `${role}_${permission}`;
  db.prepare(`
    INSERT INTO role_permissions (id, role, permission, is_allowed)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(role, permission) DO UPDATE SET is_allowed = excluded.is_allowed
  `).run(id, role, permission, isAllowed ? 1 : 0);

  return res.json({ 
    success: true, 
    message: `Permission ${permission} for role ${role} set to ${isAllowed ? 'ALLOWED' : 'DENIED'}.` 
  });
});

/**
 * GET /api/admin/user-overrides/:userId
 * Get specific permission overrides for a user
 */
router.get('/user-overrides/:userId', authenticateToken, requireAdmin, (req, res) => {
  const overrides = db.prepare(`
    SELECT * FROM user_permission_overrides WHERE user_id = ?
  `).all(req.params.userId);

  return res.json({ overrides });
});

/**
 * POST /api/admin/user-overrides
 * Set or remove user-specific permission override
 */
router.post('/user-overrides', authenticateToken, requireAdmin, (req, res) => {
  const { userId, permission, isGranted, reason } = req.body;

  if (!userId || !permission || isGranted === undefined) {
    return res.status(400).json({ error: 'userId, permission, and isGranted are required.' });
  }

  // If isGranted is null, remove override
  if (isGranted === null) {
    db.prepare('DELETE FROM user_permission_overrides WHERE user_id = ? AND permission = ?').run(userId, permission);
    return res.json({ success: true, message: 'Override removed; reverted to role default.' });
  }

  const id = `${userId}_${permission}`;
  db.prepare(`
    INSERT INTO user_permission_overrides (id, user_id, permission, is_granted, granted_by, reason)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, permission) DO UPDATE SET
      is_granted = excluded.is_granted,
      granted_by = excluded.granted_by,
      reason = excluded.reason,
      updated_at = CURRENT_TIMESTAMP
  `).run(id, userId, permission, isGranted ? 1 : 0, req.user.id, reason || 'Administrative policy update');

  return res.json({
    success: true,
    message: `User ${userId} permission ${permission} override set to ${isGranted ? 'GRANTED' : 'DENIED'}.`
  });
});

/**
 * GET /api/admin/users
 * List all registered users
 */
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.role, u.institution_id, u.region,
           u.designation, u.is_active, u.mfa_enabled, u.failed_login_attempts, u.locked_until,
           u.created_at, i.name as institution_name
    FROM users u
    LEFT JOIN institutions i ON u.institution_id = i.id
    ORDER BY u.created_at DESC
  `).all();

  return res.json({ users });
});

/**
 * PUT /api/admin/users/:id/status
 * Activate or deactivate an account
 */
router.put('/users/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const { isActive } = req.body;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(isActive ? 1 : 0, req.params.id);
  return res.json({ success: true, message: `User status updated to ${isActive ? 'Active' : 'Inactive'}.` });
});

/**
 * GET /api/admin/visibility-classifications
 * List configurable document visibility classifications (Section C)
 */
router.get('/visibility-classifications', authenticateToken, (req, res) => {
  const classifications = db.prepare('SELECT * FROM visibility_classifications').all();
  return res.json({
    classifications: classifications.map(c => ({
      ...c,
      default_allowed_roles: JSON.parse(c.default_allowed_roles)
    }))
  });
});

/**
 * PUT /api/admin/visibility-classifications/:code
 * Update allowed roles for a visibility classification
 */
router.put('/visibility-classifications/:code', authenticateToken, requireAdmin, (req, res) => {
  const { allowedRoles, label, description } = req.body;

  if (!Array.isArray(allowedRoles)) {
    return res.status(400).json({ error: 'allowedRoles must be an array of role strings.' });
  }

  db.prepare(`
    UPDATE visibility_classifications 
    SET default_allowed_roles = ?, label = COALESCE(?, label), description = COALESCE(?, description)
    WHERE code = ?
  `).run(JSON.stringify(allowedRoles), label || null, description || null, req.params.code);

  return res.json({ success: true, message: `Visibility classification ${req.params.code} updated.` });
});

module.exports = router;
