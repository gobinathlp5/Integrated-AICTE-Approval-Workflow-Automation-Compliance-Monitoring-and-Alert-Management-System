const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db, uploadsDir } = require('../db');
const { ROLES, DOC_PERMISSIONS, VISIBILITY_CATEGORIES } = require('../rbac');
const { evaluateDocumentAccess } = require('../documentAccess');
const { recordDocumentAudit } = require('../audit');
const { generateSignedDocToken, verifySignedDocToken } = require('../tokenService');
const { authenticateToken, optionalAuth } = require('../auth');

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max limit
});

/**
 * GET /api/documents
 * List documents filtered by virtual folder, search, classification, status
 * Enforces backend RBAC & confidentiality filtering
 */
router.get('/', authenticateToken, (req, res) => {
  const { folder, category, search, status, expiryStatus, applicationId, institutionId } = req.query;

  let query = `
    SELECT d.*, i.name as institution_name, i.code as institution_code,
           a.application_number
    FROM documents d
    LEFT JOIN institutions i ON d.institution_id = i.id
    LEFT JOIN applications a ON d.application_id = a.id
    WHERE d.is_latest_version = 1
  `;
  const params = [];

  // Filter by virtual folder category
  if (folder && folder !== 'ALL') {
    query += ` AND d.folder_category = ?`;
    params.push(folder.toUpperCase());
  }

  // Filter by document category
  if (category && category !== 'ALL') {
    query += ` AND d.document_category = ?`;
    params.push(category.toUpperCase());
  }

  // Filter by verification status
  if (status && status !== 'ALL') {
    query += ` AND d.verification_status = ?`;
    params.push(status.toUpperCase());
  }

  // Filter by application ID
  if (applicationId) {
    query += ` AND d.application_id = ?`;
    params.push(applicationId);
  }

  // Filter by institution ID (for admin/officer filtering)
  if (institutionId) {
    query += ` AND d.institution_id = ?`;
    params.push(institutionId);
  }

  // Text search in title or file_name or document_number
  if (search) {
    query += ` AND (d.title LIKE ? OR d.file_name LIKE ? OR d.document_number LIKE ?)`;
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  query += ` ORDER BY d.created_at DESC`;

  const allCandidateDocs = db.prepare(query).all(...params);

  // Apply backend data isolation & document-level access filter
  const visibleDocs = allCandidateDocs.filter(doc => {
    const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.VIEW);
    return access.allowed;
  });

  // Calculate expiry status & remaining days
  const now = new Date();
  const enrichedDocs = visibleDocs.map(doc => {
    let expStatus = 'NO_EXPIRY';
    let daysRemaining = null;
    if (doc.expiry_date) {
      const expDate = new Date(doc.expiry_date);
      const diffTime = expDate - now;
      daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (daysRemaining < 0) {
        expStatus = 'EXPIRED';
      } else if (daysRemaining <= 90) {
        expStatus = 'EXPIRING_SOON';
      } else {
        expStatus = 'ACTIVE';
      }
    }

    return {
      ...doc,
      computed_expiry_status: expStatus,
      days_until_expiry: daysRemaining,
      allowed_roles: doc.allowed_roles ? JSON.parse(doc.allowed_roles) : null,
      allowed_users: doc.allowed_users ? JSON.parse(doc.allowed_users) : null
    };
  });

  // Filter by computed expiry status if requested
  const finalDocs = expiryStatus && expiryStatus !== 'ALL'
    ? enrichedDocs.filter(d => d.computed_expiry_status === expiryStatus)
    : enrichedDocs;

  return res.json({
    total: finalDocs.length,
    documents: finalDocs
  });
});

/**
 * GET /api/documents/:id
 * Retrieve full document metadata and evaluate available actions for current user
 */
router.get('/:id', authenticateToken, (req, res) => {
  const doc = db.prepare(`
    SELECT d.*, i.name as institution_name, i.code as institution_code,
           a.application_number
    FROM documents d
    LEFT JOIN institutions i ON d.institution_id = i.id
    LEFT JOIN applications a ON d.application_id = a.id
    WHERE d.id = ?
  `).get(req.params.id);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Evaluate access
  const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.VIEW);
  if (!access.allowed) {
    return res.status(access.statusCode || 403).json({ 
      error: 'Access Denied', 
      message: access.reason 
    });
  }

  // Audit document VIEW
  recordDocumentAudit({
    documentId: doc.id,
    institutionId: doc.institution_id,
    applicationId: doc.application_id,
    action: 'VIEW',
    performedById: req.user.id,
    performedByName: req.user.full_name,
    performedByRole: req.user.role,
    details: { purpose: 'Metadata inspection & access' },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  // Compute what actions user is permitted to perform
  const permittedActions = {};
  Object.values(DOC_PERMISSIONS).forEach(action => {
    permittedActions[action] = evaluateDocumentAccess(req.user, doc, action).allowed;
  });

  return res.json({
    document: {
      ...doc,
      allowed_roles: doc.allowed_roles ? JSON.parse(doc.allowed_roles) : null,
      allowed_users: doc.allowed_users ? JSON.parse(doc.allowed_users) : null
    },
    permittedActions
  });
});

/**
 * POST /api/documents/upload
 * Upload new document
 */
router.post('/upload', authenticateToken, upload.single('file'), (req, res) => {
  try {
    const {
      title,
      institutionId,
      applicationId,
      documentCategory,
      folderCategory,
      confidentialityClassification = VISIBILITY_CATEGORIES.INSTITUTION_VISIBLE,
      expiryDate,
      retentionStatus = 'ACTIVE',
      allowedRoles,
      allowedUsers
    } = req.body;

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    if (!title || !documentCategory) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Title and document category are required.' });
    }

    // Determine target institution ID
    const effectiveInstId = (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF)
      ? req.user.institution_id
      : (institutionId || 'inst_delhi_001');

    // Compute SHA-256 file checksum
    const fileBuffer = fs.readFileSync(file.path);
    const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const docId = 'doc_' + uuidv4().slice(0, 10);
    const docNumber = `DOC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const parsedRoles = allowedRoles ? (typeof allowedRoles === 'string' ? allowedRoles : JSON.stringify(allowedRoles)) : null;
    const parsedUsers = allowedUsers ? (typeof allowedUsers === 'string' ? allowedUsers : JSON.stringify(allowedUsers)) : null;

    db.prepare(`
      INSERT INTO documents (
        id, document_number, title, file_name, file_path, file_size, file_type, checksum_sha256,
        institution_id, application_id, document_category, folder_category,
        uploader_id, uploader_name, uploader_role, upload_timestamp,
        verification_status, confidentiality_classification, allowed_roles, allowed_users,
        expiry_date, document_version, retention_status, is_latest_version
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'PENDING', ?, ?, ?, ?, 1, ?, 1)
    `).run(
      docId,
      docNumber,
      title,
      file.originalname,
      file.path,
      file.size,
      file.mimetype,
      checksum,
      effectiveInstId,
      applicationId || null,
      documentCategory.toUpperCase(),
      folderCategory ? folderCategory.toUpperCase() : 'APPLICATION',
      req.user.id,
      req.user.full_name,
      req.user.role,
      confidentialityClassification,
      parsedRoles,
      parsedUsers,
      expiryDate || null,
      retentionStatus
    );

    // Record initial version in document_versions table
    const verId = 'ver_' + uuidv4().slice(0, 8);
    db.prepare(`
      INSERT INTO document_versions (
        id, document_id, version, file_name, file_path, file_size, checksum_sha256,
        uploaded_by, uploaded_by_name, change_summary
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, 'Initial document upload')
    `).run(
      verId,
      docId,
      file.originalname,
      file.path,
      file.size,
      checksum,
      req.user.id,
      req.user.full_name
    );

    // Record Tamper-Evident Audit Trail Entry
    recordDocumentAudit({
      documentId: docId,
      institutionId: effectiveInstId,
      applicationId: applicationId || null,
      action: 'UPLOAD',
      performedById: req.user.id,
      performedByName: req.user.full_name,
      performedByRole: req.user.role,
      details: {
        fileName: file.originalname,
        documentCategory,
        classification: confidentialityClassification,
        checksumSha256: checksum,
        fileSize: file.size
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    const newDoc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);

    return res.status(201).json({
      success: true,
      message: 'Document uploaded successfully and registered in tamper-evident repository.',
      document: newDoc
    });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ error: 'Failed to process document upload: ' + err.message });
  }
});

/**
 * POST /api/documents/:id/signed-token
 * Generates an HMAC-SHA256 signed temporary download token (Section D & H)
 */
router.post('/:id/signed-token', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // Check download permission
  const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.DOWNLOAD);
  if (!access.allowed) {
    return res.status(access.statusCode || 403).json({ 
      error: 'Access Denied', 
      message: access.reason 
    });
  }

  const { expiresInSeconds = 300 } = req.body;
  const tokenData = generateSignedDocToken(doc.id, req.user.id, expiresInSeconds);

  return res.json({
    success: true,
    documentId: doc.id,
    downloadUrl: `/api/documents/${doc.id}/download?token=${tokenData.token}`,
    token: tokenData.token,
    expiresAt: tokenData.expiresAt,
    expiresInSeconds: tokenData.expiresInSeconds
  });
});

/**
 * GET /api/documents/:id/download
 * Downloads original document.
 * Accepts signed temporary token in query string or standard Bearer token.
 * Validates expiration, signature, and tenant isolation!
 */
router.get('/:id/download', optionalAuth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const tokenParam = req.query.token;
  let authenticatedUser = req.user;

  // Validate signed token if provided
  if (tokenParam) {
    const tokenVerification = verifySignedDocToken(tokenParam, doc.id);
    if (!tokenVerification.isValid) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `Temporary signed access token invalid or expired: ${tokenVerification.reason}`
      });
    }

    if (!authenticatedUser) {
      authenticatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(tokenVerification.userId);
    }
  }

  if (!authenticatedUser) {
    return res.status(401).json({ error: 'Authentication required to download document.' });
  }

  // Evaluate download permission
  const access = evaluateDocumentAccess(authenticatedUser, doc, DOC_PERMISSIONS.DOWNLOAD);
  if (!access.allowed) {
    return res.status(access.statusCode || 403).json({ 
      error: 'Access Denied', 
      message: access.reason 
    });
  }

  if (!fs.existsSync(doc.file_path)) {
    return res.status(404).json({ error: 'Physical file not found in storage repository.' });
  }

  // Audit document DOWNLOAD
  recordDocumentAudit({
    documentId: doc.id,
    institutionId: doc.institution_id,
    applicationId: doc.application_id,
    action: 'DOWNLOAD',
    performedById: authenticatedUser.id,
    performedByName: authenticatedUser.full_name,
    performedByRole: authenticatedUser.role,
    details: {
      fileName: doc.file_name,
      fileSize: doc.file_size,
      version: doc.document_version,
      method: tokenParam ? 'SIGNED_TEMPORARY_TOKEN' : 'DIRECT_BEARER_TOKEN'
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
  res.setHeader('Content-Type', doc.file_type || 'application/octet-stream');
  return res.sendFile(path.resolve(doc.file_path));
});

/**
 * GET /api/documents/:id/preview
 * In-browser document preview stream. Checks PREVIEW permission.
 */
router.get('/:id/preview', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.PREVIEW);
  if (!access.allowed) {
    return res.status(access.statusCode || 403).json({ error: 'Access Denied', message: access.reason });
  }

  if (!fs.existsSync(doc.file_path)) {
    return res.status(404).json({ error: 'Physical file not found in repository.' });
  }

  // Watermark metadata in response header
  res.setHeader('X-AICTE-Watermark-User', req.user.username);
  res.setHeader('X-AICTE-Watermark-Role', req.user.role);
  res.setHeader('X-AICTE-Watermark-Timestamp', new Date().toISOString());
  res.setHeader('Content-Type', doc.file_type || 'text/plain');

  return res.sendFile(path.resolve(doc.file_path));
});

/**
 * POST /api/documents/:id/replace
 * Replace document with new version (Section D).
 * MANDATORY SECURITY TEST: "A scrutiny officer cannot modify the institution's original uploaded file."
 * "An auditor cannot modify records."
 */
router.post('/:id/replace', authenticateToken, upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'Replacement file required.' });
  }

  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(404).json({ error: 'Document not found.' });
  }

  // Evaluate REPLACE permission
  const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.REPLACE);
  if (!access.allowed) {
    if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    return res.status(access.statusCode || 403).json({
      error: 'Modification Prohibited',
      message: access.reason
    });
  }

  const { changeSummary } = req.body;
  const fileBuffer = fs.readFileSync(file.path);
  const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const newVersion = doc.document_version + 1;

  // Insert into versions table
  const verId = 'ver_' + uuidv4().slice(0, 8);
  db.prepare(`
    INSERT INTO document_versions (
      id, document_id, version, file_name, file_path, file_size, checksum_sha256,
      uploaded_by, uploaded_by_name, change_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    verId,
    doc.id,
    newVersion,
    file.originalname,
    file.path,
    file.size,
    checksum,
    req.user.id,
    req.user.full_name,
    changeSummary || `Updated to version ${newVersion}`
  );

  // Update main document record
  db.prepare(`
    UPDATE documents SET
      file_name = ?,
      file_path = ?,
      file_size = ?,
      file_type = ?,
      checksum_sha256 = ?,
      document_version = ?,
      verification_status = 'PENDING',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    file.originalname,
    file.path,
    file.size,
    file.mimetype,
    checksum,
    newVersion,
    doc.id
  );

  // Record Audit
  recordDocumentAudit({
    documentId: doc.id,
    institutionId: doc.institution_id,
    applicationId: doc.application_id,
    action: 'REPLACE',
    performedById: req.user.id,
    performedByName: req.user.full_name,
    performedByRole: req.user.role,
    details: {
      previousVersion: doc.document_version,
      newVersion,
      newFileName: file.originalname,
      changeSummary: changeSummary || 'Document file replaced'
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return res.json({
    success: true,
    message: `Document replaced successfully. New version: v${newVersion}`,
    version: newVersion
  });
});

/**
 * POST /api/documents/:id/verify
 * Officer verifies or returns document
 */
router.post('/:id/verify', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.VERIFY);
  if (!access.allowed) {
    return res.status(access.statusCode || 403).json({ error: 'Access Denied', message: access.reason });
  }

  const { status, remarks } = req.body;
  const validStatuses = ['VERIFIED', 'REJECTED', 'RETURNED_FOR_CORRECTION'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status must be VERIFIED, REJECTED, or RETURNED_FOR_CORRECTION.' });
  }

  db.prepare(`
    UPDATE documents SET
      verification_status = ?,
      verified_by = ?,
      verified_at = CURRENT_TIMESTAMP,
      verification_remarks = ?
    WHERE id = ?
  `).run(status, req.user.id, remarks || null, doc.id);

  // Record Audit
  recordDocumentAudit({
    documentId: doc.id,
    institutionId: doc.institution_id,
    applicationId: doc.application_id,
    action: status === 'VERIFIED' ? 'VERIFY' : 'RETURN',
    performedById: req.user.id,
    performedByName: req.user.full_name,
    performedByRole: req.user.role,
    details: {
      previousStatus: doc.verification_status,
      newStatus: status,
      remarks: remarks || ''
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return res.json({
    success: true,
    message: `Document verification status updated to ${status}.`,
    verificationStatus: status
  });
});

/**
 * PUT /api/documents/:id/visibility
 * Update confidentiality classification
 * MANDATORY SECURITY TEST: "Changing document visibility creates an audit record."
 */
router.put('/:id/visibility', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.CHANGE_VISIBILITY);
  if (!access.allowed) {
    return res.status(access.statusCode || 403).json({ error: 'Access Denied', message: access.reason });
  }

  const { classification, allowedRoles, allowedUsers } = req.body;
  if (!classification) {
    return res.status(400).json({ error: 'New classification required.' });
  }

  const rolesJson = allowedRoles ? (typeof allowedRoles === 'string' ? allowedRoles : JSON.stringify(allowedRoles)) : doc.allowed_roles;
  const usersJson = allowedUsers ? (typeof allowedUsers === 'string' ? allowedUsers : JSON.stringify(allowedUsers)) : doc.allowed_users;

  db.prepare(`
    UPDATE documents SET
      confidentiality_classification = ?,
      allowed_roles = ?,
      allowed_users = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(classification, rolesJson, usersJson, doc.id);

  // Record CHANGE_VISIBILITY in tamper-evident audit log
  recordDocumentAudit({
    documentId: doc.id,
    institutionId: doc.institution_id,
    applicationId: doc.application_id,
    action: 'CHANGE_VISIBILITY',
    performedById: req.user.id,
    performedByName: req.user.full_name,
    performedByRole: req.user.role,
    details: {
      oldClassification: doc.confidentiality_classification,
      newClassification: classification,
      allowedRoles: rolesJson,
      allowedUsers: usersJson
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });

  return res.json({
    success: true,
    message: `Confidentiality classification updated from ${doc.confidentiality_classification} to ${classification}.`,
    classification
  });
});

/**
 * GET /api/documents/:id/versions
 * View document version history
 */
router.get('/:id/versions', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.VIEW_VERSION_HISTORY);
  if (!access.allowed) {
    return res.status(access.statusCode || 403).json({ error: 'Access Denied', message: access.reason });
  }

  const versions = db.prepare(`
    SELECT * FROM document_versions WHERE document_id = ? ORDER BY version DESC
  `).all(doc.id);

  return res.json({ versions });
});

/**
 * DELETE /api/documents/:id
 * Delete document where legally permitted
 */
router.delete('/:id', authenticateToken, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const access = evaluateDocumentAccess(req.user, doc, DOC_PERMISSIONS.DELETE);
  if (!access.allowed) {
    // Record rejected attempt in audit
    recordDocumentAudit({
      documentId: doc.id,
      institutionId: doc.institution_id,
      applicationId: doc.application_id,
      action: 'DELETE_ATTEMPT',
      performedById: req.user.id,
      performedByName: req.user.full_name,
      performedByRole: req.user.role,
      details: { rejectedReason: access.reason }
    });

    return res.status(access.statusCode || 403).json({ 
      error: 'Delete Prohibited', 
      message: access.reason 
    });
  }

  // Delete versions & document
  db.prepare('DELETE FROM document_versions WHERE document_id = ?').run(doc.id);
  db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);

  if (fs.existsSync(doc.file_path)) {
    try { fs.unlinkSync(doc.file_path); } catch (e) {}
  }

  recordDocumentAudit({
    documentId: doc.id,
    institutionId: doc.institution_id,
    applicationId: doc.application_id,
    action: 'DELETE',
    performedById: req.user.id,
    performedByName: req.user.full_name,
    performedByRole: req.user.role,
    details: { documentTitle: doc.title, documentNumber: doc.document_number }
  });

  return res.json({ success: true, message: 'Document deleted successfully.' });
});

module.exports = router;
