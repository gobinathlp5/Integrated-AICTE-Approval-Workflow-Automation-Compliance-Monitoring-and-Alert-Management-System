const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');

const CHANNELS = {
  INSTITUTION_VISIBLE: 'INSTITUTION_VISIBLE',
  INTERNAL_AICTE: 'INTERNAL_AICTE',
  COMMITTEE_RESTRICTED: 'COMMITTEE_RESTRICTED',
  COMPETENT_AUTHORITY: 'COMPETENT_AUTHORITY'
};

/**
 * GET /api/comments
 * Retrieve comments filtered by documentId or applicationId.
 * MANDATORY REQUIREMENT: Prevent internal comments from appearing in the institution portal
 * unless explicitly released by an authorized user!
 */
router.get('/', authenticateToken, (req, res) => {
  const { documentId, applicationId, institutionId } = req.query;

  let query = `
    SELECT c.*, u.full_name as author_full_name, u.role as author_role
    FROM comments c
    LEFT JOIN users u ON c.author_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (documentId) {
    query += ` AND c.document_id = ?`;
    params.push(documentId);
  }

  if (applicationId) {
    query += ` AND c.application_id = ?`;
    params.push(applicationId);
  }

  if (institutionId) {
    query += ` AND c.institution_id = ?`;
    params.push(institutionId);
  }

  query += ` ORDER BY c.created_at ASC`;
  const allComments = db.prepare(query).all(...params);

  const isInstitutionUser = req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF;

  // Filter according to channel rules
  const visibleComments = allComments.filter(comment => {
    // If institution user:
    if (isInstitutionUser) {
      // Must belong to their institution
      if (comment.institution_id !== req.user.institution_id) {
        return false;
      }
      // Can ONLY see INSTITUTION_VISIBLE remarks OR internal notes that have been EXPLICITLY RELEASED
      if (comment.channel === CHANNELS.INSTITUTION_VISIBLE) {
        return true;
      }
      if (comment.is_released_to_institution === 1) {
        return true;
      }
      return false; // INTERNAL_AICTE, COMMITTEE_RESTRICTED, COMPETENT_AUTHORITY remarks remain strictly hidden!
    }

    // If EVC Member:
    if (req.user.role === ROLES.EVC_MEMBER) {
      // Can see INSTITUTION_VISIBLE and COMMITTEE_RESTRICTED
      return comment.channel === CHANNELS.INSTITUTION_VISIBLE || 
             comment.channel === CHANNELS.COMMITTEE_RESTRICTED ||
             comment.is_released_to_institution === 1;
    }

    // AICTE internal officers, Admins, Competent Authority, and Auditor can see all channels
    return true;
  });

  return res.json({
    total: visibleComments.length,
    comments: visibleComments
  });
});

/**
 * POST /api/comments
 * Post a new remark or note to a specific communication channel
 */
router.post('/', authenticateToken, (req, res) => {
  const {
    documentId,
    applicationId,
    institutionId,
    channel = CHANNELS.INSTITUTION_VISIBLE,
    commentText
  } = req.body;

  if (!commentText || !commentText.trim()) {
    return res.status(400).json({ error: 'Comment text cannot be empty.' });
  }

  const isInstitutionUser = req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF;

  // Security barrier: Institution users cannot post to internal AICTE or Committee channels
  if (isInstitutionUser && channel !== CHANNELS.INSTITUTION_VISIBLE) {
    return res.status(403).json({
      error: 'Channel Restricted',
      message: 'Institution users can only post to the Institution-Visible communication channel.'
    });
  }

  // Determine institution ID
  let effInstId = institutionId;
  if (!effInstId && documentId) {
    const doc = db.prepare('SELECT institution_id FROM documents WHERE id = ?').get(documentId);
    if (doc) effInstId = doc.institution_id;
  }
  if (!effInstId && applicationId) {
    const app = db.prepare('SELECT institution_id FROM applications WHERE id = ?').get(applicationId);
    if (app) effInstId = app.institution_id;
  }
  if (!effInstId && req.user.institution_id) {
    effInstId = req.user.institution_id;
  }

  const commentId = 'cmt_' + uuidv4().slice(0, 10);
  db.prepare(`
    INSERT INTO comments (
      id, document_id, application_id, institution_id, channel,
      author_id, author_name, author_role, comment_text, is_released_to_institution
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    commentId,
    documentId || null,
    applicationId || null,
    effInstId,
    channel,
    req.user.id,
    req.user.full_name,
    req.user.role,
    commentText.trim(),
    channel === CHANNELS.INSTITUTION_VISIBLE ? 1 : 0
  );

  const created = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);
  return res.status(201).json({
    success: true,
    message: `Remark posted to [${channel}] channel successfully.`,
    comment: created
  });
});

/**
 * POST /api/comments/:id/release
 * Authorised officer explicitly releases an internal note to the institution
 */
router.post('/:id/release', authenticateToken, (req, res) => {
  const allowedRoles = [
    ROLES.SUPER_ADMIN, ROLES.AICTE_ADMIN, ROLES.REGULATION_BUREAU,
    ROLES.REGIONAL_OFFICER, ROLES.BUREAU_OFFICER, ROLES.SCRUTINY_OFFICER,
    ROLES.COMPETENT_AUTHORITY
  ];

  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      error: 'Permission Denied',
      message: `Role ${req.user.role} is not authorized to release internal notes to institutions.`
    });
  }

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(req.params.id);
  if (!comment) {
    return res.status(404).json({ error: 'Comment record not found' });
  }

  db.prepare(`
    UPDATE comments SET
      is_released_to_institution = 1,
      released_by = ?,
      released_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.id, comment.id);

  return res.json({
    success: true,
    message: `Note ID ${comment.id} has been formally released and is now visible in the Institution portal.`,
    releasedBy: req.user.full_name
  });
});

module.exports = router;
