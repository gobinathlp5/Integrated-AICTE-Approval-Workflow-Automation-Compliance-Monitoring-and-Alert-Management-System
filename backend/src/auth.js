const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');
const { ROLES } = require('./rbac');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: JWT_SECRET environment variable is mandatory in production.');
  }
  JWT_SECRET = 'aicte-centralized-jwt-auth-secret-key-2026';
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 15;

/**
 * Signs JWT authentication token
 */
function generateAuthToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      institution_id: user.institution_id,
      region: user.region,
      full_name: user.full_name
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
}

/**
 * Middleware: Verifies JWT token and attaches user to request
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      error: 'Access Denied', 
      message: 'No authorization bearer token provided.' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ 
        error: 'Forbidden', 
        message: 'Invalid or expired authorization session token.' 
      });
    }

    // Fetch fresh user record from DB to verify active status
    const freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!freshUser) {
      return res.status(401).json({ error: 'User account no longer exists.' });
    }
    if (!freshUser.is_active) {
      return res.status(403).json({ error: 'Account is deactivated. Contact AICTE administrator.' });
    }

    req.user = freshUser;
    next();
  });
}

/**
 * Optional authentication: attaches user if token is present and valid, otherwise proceeds as anonymous
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err && decoded) {
        req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
      }
      next();
    });
  } else {
    next();
  }
}

/**
 * Records login event in the login_history table
 */
function recordLoginHistory({ userId = null, username, ipAddress, userAgent, status, failureReason = null }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO login_history (id, user_id, username_attempted, ip_address, user_agent, status, failure_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(uuidv4(), userId, username, ipAddress, userAgent, status, failureReason);
  } catch (err) {
    console.error('Failed to log login history:', err);
  }
}

/**
 * Centralized login handler with failed-login counter & lockout protection
 */
async function authenticateUser({ username, password, ipAddress = '127.0.0.1', userAgent = 'AICTE-Client' }) {
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);

  if (!user) {
    recordLoginHistory({
      username,
      ipAddress,
      userAgent,
      status: 'FAILED_BAD_CREDENTIALS',
      failureReason: 'User not found'
    });
    return { success: false, statusCode: 401, error: 'Invalid username or password.' };
  }

  // Check if account is locked
  if (user.locked_until) {
    const lockTime = new Date(user.locked_until);
    if (lockTime > new Date()) {
      const remainingMinutes = Math.ceil((lockTime - new Date()) / 60000);
      recordLoginHistory({
        userId: user.id,
        username,
        ipAddress,
        userAgent,
        status: 'LOCKED',
        failureReason: `Account locked. ${remainingMinutes} mins remaining`
      });
      return { 
        success: false, 
        statusCode: 423, 
        error: `Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minutes.` 
      };
    } else {
      // Lock expired, reset
      db.prepare('UPDATE users SET locked_until = NULL, failed_login_attempts = 0 WHERE id = ?').run(user.id);
      user.failed_login_attempts = 0;
      user.locked_until = null;
    }
  }

  // Check if account is active
  if (!user.is_active) {
    recordLoginHistory({
      userId: user.id,
      username,
      ipAddress,
      userAgent,
      status: 'FAILED_DEACTIVATED',
      failureReason: 'Account deactivated'
    });
    return { success: false, statusCode: 403, error: 'Account is deactivated. Contact AICTE administrator.' };
  }

  // Verify password
  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    const attempts = (user.failed_login_attempts || 0) + 1;
    let lockedUntil = null;

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const lockDate = new Date();
      lockDate.setMinutes(lockDate.getMinutes() + LOCKOUT_DURATION_MINUTES);
      lockedUntil = lockDate.toISOString();
      db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockedUntil, user.id);
      
      recordLoginHistory({
        userId: user.id,
        username,
        ipAddress,
        userAgent,
        status: 'LOCKED',
        failureReason: `Locked after ${attempts} failed attempts`
      });

      return { 
        success: false, 
        statusCode: 423, 
        error: `Maximum login attempts exceeded. Account is locked for ${LOCKOUT_DURATION_MINUTES} minutes.` 
      };
    } else {
      db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
      const remaining = MAX_FAILED_ATTEMPTS - attempts;

      recordLoginHistory({
        userId: user.id,
        username,
        ipAddress,
        userAgent,
        status: 'FAILED_BAD_CREDENTIALS',
        failureReason: `Incorrect password (${remaining} attempts left)`
      });

      return { 
        success: false, 
        statusCode: 401, 
        error: `Invalid username or password. ${remaining} attempt(s) remaining before account lockout.` 
      };
    }
  }

  // Check if MFA is required
  if (user.mfa_enabled) {
    // Generate secure 6-digit cryptographic OTP (Prompt 3.1: remove universal 123456)
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = bcrypt.hashSync(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 min TTL

    db.prepare(`
      UPDATE users SET mfa_temp_code = ?, mfa_code_expires_at = ?, mfa_attempts = 0
      WHERE id = ?
    `).run(otpHash, expiresAt, user.id);

    recordLoginHistory({
      userId: user.id,
      username,
      ipAddress,
      userAgent,
      status: 'MFA_PENDING'
    });

    const mfaSessionToken = jwt.sign(
      { id: user.id, mfaPending: true },
      JWT_SECRET,
      { expiresIn: '5m' }
    );

    const isNonProd = process.env.NODE_ENV !== 'production';

    return {
      success: true,
      requiresMfa: true,
      mfaSessionToken,
      userId: user.id,
      message: 'MFA 6-digit security code dispatched to registered contact channel.',
      devOtpCode: isNonProd ? otp : undefined
    };
  }

  // Successful login without MFA
  db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
  recordLoginHistory({
    userId: user.id,
    username,
    ipAddress,
    userAgent,
    status: 'SUCCESS'
  });

  const token = generateAuthToken(user);
  const dashboardRoute = getAuthorizedDashboard(user.role);

  return {
    success: true,
    token,
    user: sanitizeUser(user),
    dashboardRoute
  };
}

/**
 * Verifies MFA code and issues final authorization session token
 * SEC-RULE: Strictly removes universal/demo 123456 codes. Requires authentic dynamic OTP.
 */
function verifyMfa({ mfaSessionToken, code, ipAddress = '127.0.0.1', userAgent = 'AICTE-Client' }) {
  try {
    const decoded = jwt.verify(mfaSessionToken, JWT_SECRET);
    if (!decoded.mfaPending || !decoded.id) {
      return { success: false, statusCode: 400, error: 'Invalid MFA session token.' };
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return { success: false, statusCode: 404, error: 'User not found.' };
    }

    if (!user.mfa_temp_code || !user.mfa_code_expires_at) {
      return { success: false, statusCode: 400, error: 'No active MFA challenge found. Please re-authenticate.' };
    }

    if (new Date() > new Date(user.mfa_code_expires_at)) {
      return { success: false, statusCode: 400, error: 'MFA verification code has expired. Please log in again.' };
    }

    const currentAttempts = (user.mfa_attempts || 0) + 1;
    if (currentAttempts > 3) {
      db.prepare('UPDATE users SET mfa_temp_code = NULL, mfa_code_expires_at = NULL WHERE id = ?').run(user.id);
      recordLoginHistory({
        userId: user.id,
        username: user.username,
        ipAddress,
        userAgent,
        status: 'MFA_LOCKED',
        failureReason: 'Maximum MFA attempts exceeded'
      });
      return { success: false, statusCode: 429, error: 'Maximum MFA attempts exceeded. Challenge revoked. Please log in again.' };
    }

    const isMatch = bcrypt.compareSync(code.trim(), user.mfa_temp_code);
    if (!isMatch) {
      db.prepare('UPDATE users SET mfa_attempts = ? WHERE id = ?').run(currentAttempts, user.id);
      recordLoginHistory({
        userId: user.id,
        username: user.username,
        ipAddress,
        userAgent,
        status: 'MFA_FAILED',
        failureReason: `Invalid verification code (${3 - currentAttempts} attempts remaining)`
      });
      return { success: false, statusCode: 401, error: `Invalid MFA verification code. ${3 - currentAttempts} attempt(s) remaining.` };
    }

    // Success: Clear challenge and reset lockout
    db.prepare(`
      UPDATE users SET failed_login_attempts = 0, locked_until = NULL,
                       mfa_temp_code = NULL, mfa_code_expires_at = NULL, mfa_attempts = 0
      WHERE id = ?
    `).run(user.id);

    recordLoginHistory({
      userId: user.id,
      username: user.username,
      ipAddress,
      userAgent,
      status: 'SUCCESS'
    });

    const token = generateAuthToken(user);
    const dashboardRoute = getAuthorizedDashboard(user.role);

    return {
      success: true,
      token,
      user: sanitizeUser(user),
      dashboardRoute
    };
  } catch (err) {
    return { success: false, statusCode: 401, error: 'MFA session expired or invalid.' };
  }
}

/**
 * Initiates secure password recovery token
 */
function initiatePasswordRecovery(emailOrUsername) {
  const user = db.prepare('SELECT * FROM users WHERE email = ? OR username = ?').get(emailOrUsername, emailOrUsername);
  if (!user) {
    // Return generic success to prevent account enumeration
    return { success: true, message: 'If an account matches those details, recovery instructions have been dispatched.' };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 min TTL

  db.prepare('UPDATE users SET reset_token = ?, reset_token_expires_at = ? WHERE id = ?').run(resetToken, expiresAt, user.id);

  const isNonProd = process.env.NODE_ENV !== 'production';
  return {
    success: true,
    message: 'If an account matches those details, recovery instructions have been dispatched.',
    devResetToken: isNonProd ? resetToken : undefined
  };
}

/**
 * Completes secure password reset
 */
function completePasswordReset(token, newPassword) {
  if (!token || !newPassword || newPassword.length < 8) {
    return { success: false, statusCode: 400, error: 'Valid token and strong password (min 8 characters) required.' };
  }

  const user = db.prepare('SELECT * FROM users WHERE reset_token = ?').get(token);
  if (!user || !user.reset_token_expires_at || new Date() > new Date(user.reset_token_expires_at)) {
    return { success: false, statusCode: 400, error: 'Password reset link is invalid or has expired.' };
  }

  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.prepare(`
    UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires_at = NULL,
                     failed_login_attempts = 0, locked_until = NULL
    WHERE id = ?
  `).run(passwordHash, user.id);

  return { success: true, message: 'Password has been successfully reset. Please log in with your new credentials.' };
}

/**
 * Returns authorized dashboard route based on user role (Section A)
 */
function getAuthorizedDashboard(role) {
  switch (role) {
    case ROLES.SUPER_ADMIN:
      return '/dashboard/super-admin';
    case ROLES.AICTE_ADMIN:
      return '/dashboard/aicte-admin';
    case ROLES.REGULATION_BUREAU:
      return '/dashboard/regulation-bureau';
    case ROLES.REGIONAL_OFFICER:
      return '/dashboard/regional-officer';
    case ROLES.BUREAU_OFFICER:
      return '/dashboard/bureau-officer';
    case ROLES.SCRUTINY_OFFICER:
      return '/dashboard/scrutiny-officer';
    case ROLES.EVC_COORDINATOR:
      return '/dashboard/evc-coordinator';
    case ROLES.EVC_MEMBER:
      return '/dashboard/evc-member';
    case ROLES.SAC_SHC_MEMBER:
      return '/dashboard/sac-shc';
    case ROLES.COMPETENT_AUTHORITY:
      return '/dashboard/competent-authority';
    case ROLES.INSTITUTION_ADMIN:
    case ROLES.INSTITUTION_STAFF:
      return '/dashboard/institution';
    case ROLES.AUDITOR:
      return '/dashboard/auditor';
    default:
      return '/dashboard';
  }
}

function sanitizeUser(user) {
  const { password_hash, mfa_secret, ...safeUser } = user;
  return safeUser;
}

module.exports = {
  JWT_SECRET,
  generateAuthToken,
  authenticateToken,
  optionalAuth,
  authenticateUser,
  verifyMfa,
  recordLoginHistory,
  getAuthorizedDashboard,
  sanitizeUser,
  initiatePasswordRecovery,
  completePasswordReset
};
