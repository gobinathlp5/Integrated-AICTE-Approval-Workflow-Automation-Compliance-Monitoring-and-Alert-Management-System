const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const {
  authenticateUser,
  verifyMfa,
  authenticateToken,
  recordLoginHistory,
  generateAuthToken,
  getAuthorizedDashboard,
  sanitizeUser
} = require('../auth');

/**
 * POST /api/auth/login
 * Centralized login for all 13 user categories.
 */
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Browser';

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const result = await authenticateUser({
    username,
    password,
    ipAddress,
    userAgent
  });

  if (!result.success) {
    return res.status(result.statusCode || 401).json({ error: result.error });
  }

  return res.json(result);
});

/**
 * POST /api/auth/verify-mfa
 * Verify second factor authentication code
 */
router.post('/verify-mfa', (req, res) => {
  const { mfaSessionToken, code } = req.body;
  const ipAddress = req.ip || '127.0.0.1';
  const userAgent = req.headers['user-agent'] || 'Browser';

  if (!mfaSessionToken || !code) {
    return res.status(400).json({ error: 'MFA session token and verification code are required.' });
  }

  const result = verifyMfa({ mfaSessionToken, code, ipAddress, userAgent });
  if (!result.success) {
    return res.status(result.statusCode || 401).json({ error: result.error });
  }

  return res.json(result);
});

/**
 * POST /api/auth/register
 * Public registration endpoint.
 * MANDATORY SECURITY REQUIREMENT: "Do not allow public users to select privileged AICTE roles during registration."
 */
router.post('/register', (req, res) => {
  const {
    username,
    email,
    password,
    fullName,
    role,
    institutionCode,
    institutionName,
    region,
    state,
    city
  } = req.body;

  // Security check: restrict public registration only to Institution roles
  const allowedPublicRoles = [ROLES.INSTITUTION_ADMIN, ROLES.INSTITUTION_STAFF];
  
  if (!role || !allowedPublicRoles.includes(role)) {
    return res.status(403).json({
      error: 'Privilege Escalation Blocked',
      message: 'Public self-registration is strictly restricted to Institution representatives. Privileged AICTE Administrative and Bureau Officer accounts must be officially provisioned by the AICTE National Portal Administrators.'
    });
  }

  if (!username || !email || !password || !fullName || !institutionCode || !institutionName) {
    return res.status(400).json({ error: 'Please provide all required registration and institution details.' });
  }

  // Check existing username / email
  const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
  if (existing) {
    return res.status(400).json({ error: 'Username or email is already registered.' });
  }

  // Create or find institution
  let inst = db.prepare('SELECT id FROM institutions WHERE code = ?').get(institutionCode);
  let institutionId = inst ? inst.id : null;

  if (!institutionId) {
    institutionId = 'inst_' + uuidv4().slice(0, 8);
    db.prepare(`
      INSERT INTO institutions (id, code, name, type, region, state, city, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(
      institutionId,
      institutionCode,
      institutionName,
      'Engineering & Technology',
      region || 'Northern',
      state || 'Delhi',
      city || 'New Delhi'
    );
  }

  // Create User
  const userId = 'usr_' + uuidv4().slice(0, 8);
  const passwordHash = bcrypt.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (
      id, username, email, password_hash, full_name, role, institution_id, region, designation, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    userId,
    username,
    email,
    passwordHash,
    fullName,
    role,
    institutionId,
    region || 'Northern',
    role === ROLES.INSTITUTION_ADMIN ? 'Principal / Director' : 'Authorized Representative'
  );

  const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const token = generateAuthToken(newUser);
  const dashboardRoute = getAuthorizedDashboard(newUser.role);

  return res.status(201).json({
    success: true,
    message: 'Institution account registered and activated successfully.',
    token,
    user: sanitizeUser(newUser),
    dashboardRoute
  });
});

/**
 * GET /api/auth/me
 * Get currently authenticated user profile
 */
router.get('/me', authenticateToken, (req, res) => {
  const institution = req.user.institution_id 
    ? db.prepare('SELECT * FROM institutions WHERE id = ?').get(req.user.institution_id)
    : null;

  return res.json({
    user: sanitizeUser(req.user),
    institution,
    dashboardRoute: getAuthorizedDashboard(req.user.role)
  });
});

/**
 * POST /api/auth/quick-switch
 * Demo helper to easily switch between all 13 user roles for hackathon review/testing
 */
router.post('/quick-switch', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Quick demo role switching is strictly disabled in production environments.'
    });
  }
  const { role, username } = req.body;
  let user;

  if (username) {
    user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  } else if (role) {
    user = db.prepare('SELECT * FROM users WHERE role = ? AND is_active = 1 LIMIT 1').get(role);
  }

  if (!user) {
    return res.status(404).json({ error: `No active demo account found for role: ${role || username}` });
  }

  const token = generateAuthToken(user);
  return res.json({
    success: true,
    token,
    user: sanitizeUser(user),
    dashboardRoute: getAuthorizedDashboard(user.role)
  });
});

/**
 * GET /api/auth/login-history
 * View login audit records
 */
router.get('/login-history', authenticateToken, (req, res) => {
  // If Super Admin or Auditor, can view all login history. Otherwise, only own records.
  const isPrivileged = [ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.AUDITOR].includes(req.user.role);

  let records;
  if (isPrivileged) {
    records = db.prepare(`
      SELECT lh.*, u.full_name, u.role 
      FROM login_history lh
      LEFT JOIN users u ON lh.user_id = u.id
      ORDER BY lh.attempted_at DESC LIMIT 50
    `).all();
  } else {
    records = db.prepare(`
      SELECT * FROM login_history 
      WHERE user_id = ? OR username_attempted = ?
      ORDER BY attempted_at DESC LIMIT 20
    `).all(req.user.id, req.user.username);
  }

  return res.json({ records });
});

/**
 * POST /api/auth/toggle-mfa
 * Turn on/off MFA for current user
 */
router.post('/toggle-mfa', authenticateToken, (req, res) => {
  const newStatus = req.user.mfa_enabled ? 0 : 1;
  db.prepare('UPDATE users SET mfa_enabled = ? WHERE id = ?').run(newStatus, req.user.id);
  return res.json({ 
    success: true, 
    mfaEnabled: newStatus === 1,
    message: newStatus === 1 ? 'MFA enabled. Demo code: 123456' : 'MFA disabled.' 
  });
});

module.exports = router;
