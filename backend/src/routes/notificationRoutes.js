const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * GET /api/notifications
 * Retrieve notification feed for authenticated user with strict ownership filtering
 */
router.get('/', authenticateToken, (req, res) => {
  let query = `
    SELECT * FROM notifications
    WHERE 1=1
  `;
  const params = [];

  // Strict tenant and user ownership
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND (user_id = ? OR institution_id = ?)`;
    params.push(req.user.id, req.user.institution_id);
  } else {
    // For Council officers, show explicitly targeted user_id, or role_target
    query += ` AND (user_id = ? OR role_target = ? OR (institution_id IS NULL AND role_target IS NULL))`;
    params.push(req.user.id, req.user.role);
  }

  query += ` ORDER BY created_at DESC LIMIT 50`;
  const notifications = db.prepare(query).all(...params);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return successResponse(res, notifications, 'Notifications retrieved');
});

/**
 * Common handler for marking single notification as read
 * Enforces ownership check: User cannot mark another tenant's notification as read!
 */
function handleMarkRead(req, res) {
  const notifId = req.params.id;
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(notifId);

  if (!notif) {
    return errorResponse(res, 'Notification not found', 404, 'NOT_FOUND');
  }

  // Ownership verification
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    const isOwnerUser = notif.user_id === req.user.id;
    const isOwnerInst = notif.institution_id === req.user.institution_id;
    if (!isOwnerUser && !isOwnerInst) {
      return errorResponse(res, 'Access Denied: You do not own this notification.', 403, 'FORBIDDEN');
    }
  } else {
    if (notif.user_id && notif.user_id !== req.user.id && notif.role_target && notif.role_target !== req.user.role) {
      return errorResponse(res, 'Access Denied: Notification belongs to another officer.', 403, 'FORBIDDEN');
    }
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(notifId);
  return successResponse(res, { notificationId: notifId, is_read: 1 }, 'Notification marked as read.');
}

router.put('/:id/read', authenticateToken, handleMarkRead);
router.post('/:id/read', authenticateToken, handleMarkRead);

/**
 * Common handler for marking all notifications as read
 */
function handleMarkAllRead(req, res) {
  if (req.user.institution_id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE institution_id = ? OR user_id = ?')
      .run(req.user.institution_id, req.user.id);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR role_target = ?')
      .run(req.user.id, req.user.role);
  }
  return successResponse(res, { markedAll: true }, 'All notifications marked as read.');
}

router.put('/read-all', authenticateToken, handleMarkAllRead);
router.post('/read-all', authenticateToken, handleMarkAllRead);

module.exports = router;
