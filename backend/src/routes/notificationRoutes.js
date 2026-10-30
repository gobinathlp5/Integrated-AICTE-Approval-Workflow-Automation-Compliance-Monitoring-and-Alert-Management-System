const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');

/**
 * GET /api/notifications
 * Retrieve notification feed for authenticated user
 */
router.get('/', authenticateToken, (req, res) => {
  let query = `
    SELECT * FROM notifications
    WHERE 1=1
  `;
  const params = [];

  // If user is institution user, show institution notifications or specific user notifications
  if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
    query += ` AND (user_id = ? OR institution_id = ? OR role_target = ?)`;
    params.push(req.user.id, req.user.institution_id, req.user.role);
  } else {
    // For officers, show their user_id, or role_target, or general broadcasts
    query += ` AND (user_id = ? OR role_target = ? OR role_target IS NULL)`;
    params.push(req.user.id, req.user.role);
  }

  query += ` ORDER BY created_at DESC LIMIT 50`;
  const notifications = db.prepare(query).all(...params);

  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  return res.json({
    total: notifications.length,
    unreadCount,
    notifications
  });
});

/**
 * PUT /api/notifications/:id/read
 * Mark a single notification as read
 */
router.put('/:id/read', authenticateToken, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  return res.json({ success: true, message: 'Notification marked as read.' });
});

/**
 * PUT /api/notifications/read-all
 * Mark all visible notifications as read
 */
router.put('/read-all', authenticateToken, (req, res) => {
  if (req.user.institution_id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE institution_id = ? OR user_id = ?').run(req.user.institution_id, req.user.id);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR role_target = ?').run(req.user.id, req.user.role);
  }
  return res.json({ success: true, message: 'All notifications marked as read.' });
});

module.exports = router;
