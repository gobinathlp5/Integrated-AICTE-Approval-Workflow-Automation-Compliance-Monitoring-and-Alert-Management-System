const { v4: uuidv4 } = require('uuid');
const { db } = require('./db');

function createNotification({
  userId = null,
  roleTarget = null,
  institutionId = null,
  title,
  message,
  type = 'INFO',
  link = null
}) {
  try {
    const id = 'notif_' + uuidv4().slice(0, 10);
    const stmt = db.prepare(`
      INSERT INTO notifications (id, user_id, role_target, institution_id, title, message, type, link, is_read, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `);
    stmt.run(id, userId, roleTarget, institutionId, title, message, type, link);
    return id;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

module.exports = {
  createNotification
};
