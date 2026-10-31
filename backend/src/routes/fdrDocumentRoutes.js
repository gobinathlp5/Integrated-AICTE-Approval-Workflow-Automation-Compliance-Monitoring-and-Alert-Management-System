const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db, uploadsDir } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken, optionalAuth } = require('../auth');
const { recordDocumentAudit } = require('../audit');
const { generateSignedDocToken, verifySignedDocToken } = require('../tokenService');
const { successResponse, errorResponse } = require('../utils/responseHelper');

// Multer storage for FDR uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = 'fdr-' + Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB max limit
});

function checkInstitutionAccess(user, targetInstitutionId) {
  if (user.role === ROLES.SUPER_ADMIN || user.role === ROLES.AICTE_ADMIN || 
      user.role === ROLES.REGULATION_BUREAU || user.role === ROLES.REGIONAL_OFFICER || 
      user.role === ROLES.BUREAU_OFFICER || user.role === ROLES.AUDITOR ||
      user.role === ROLES.COMPETENT_AUTHORITY) {
    return true;
  }
  return user.institution_id === targetInstitutionId;
}

/**
 * POST /api/fdr/:id/documents
 * Upload document attached to an FDR record
 */
router.post('/:id/documents', authenticateToken, upload.single('file'), (req, res) => {
  const file = req.file;
  if (!file) {
    return errorResponse(res, 'No file uploaded', 400, 'FILE_REQUIRED');
  }

  try {
    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(req.params.id);
    if (!fdr) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return errorResponse(res, 'FDR record not found', 404, 'NOT_FOUND');
    }

    if (!checkInstitutionAccess(req.user, fdr.institution_id)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return errorResponse(res, 'Access denied: Cannot upload documents for this institution', 403, 'FORBIDDEN');
    }

    const { document_type = 'FDR_SCAN', version = 1 } = req.body;

    // Calculate SHA-256 hash of file content for integrity
    const fileBuffer = fs.readFileSync(file.path);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const docId = uuidv4();
    const insertStmt = db.prepare(`
      INSERT INTO fdr_documents (
        id, fdr_id, institution_id, document_type, file_name,
        stored_path, file_size, mime_type, file_hash_sha256,
        version, verification_status, uploaded_by, uploaded_by_name,
        uploaded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNVERIFIED', ?, ?, CURRENT_TIMESTAMP)
    `);

    insertStmt.run(
      docId,
      fdr.id,
      fdr.institution_id,
      document_type,
      file.originalname,
      file.path,
      file.size,
      file.mimetype || 'application/pdf',
      fileHash,
      Number(version) || 1,
      req.user.id,
      req.user.full_name || req.user.username
    );

    // Audit trail
    recordDocumentAudit({
      documentId: docId,
      institutionId: fdr.institution_id,
      action: 'FDR_DOCUMENT_UPLOADED',
      performedById: req.user.id,
      performedByName: req.user.full_name || req.user.username,
      performedByRole: req.user.role,
      details: {
        fdr_id: fdr.id,
        fdr_number: fdr.fdr_number,
        document_type,
        file_name: file.originalname,
        file_size: file.size,
        file_hash_sha256: fileHash
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    const insertedDoc = db.prepare('SELECT * FROM fdr_documents WHERE id = ?').get(docId);
    return successResponse(res, insertedDoc, 'Document uploaded successfully', 201);
  } catch (err) {
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    console.error('Error in FDR document upload:', err);
    return errorResponse(res, 'Failed to upload document: ' + err.message, 500);
  }
});

/**
 * POST /api/fdr/documents/:docId/token
 * Generate temporary HMAC signed token for FDR document preview/download
 */
router.post('/documents/:docId/token', authenticateToken, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM fdr_documents WHERE id = ?').get(req.params.docId);
    if (!doc) {
      return errorResponse(res, 'Document not found', 404, 'NOT_FOUND');
    }

    if (!checkInstitutionAccess(req.user, doc.institution_id)) {
      return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
    }

    const tokenResult = generateSignedDocToken(doc.id, req.user.id, 300);
    return successResponse(res, tokenResult, 'Signed document token generated');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * GET /api/fdr/documents/:docId/download
 * Download FDR document with authorization (Bearer or HMAC token)
 */
router.get('/documents/:docId/download', optionalAuth, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM fdr_documents WHERE id = ?').get(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    let authenticatedUser = req.user;
    const tokenParam = req.query.token;

    if (!authenticatedUser && tokenParam) {
      const tokenVerification = verifySignedDocToken(tokenParam, doc.id);
      if (!tokenVerification.isValid) {
        return res.status(403).json({ error: 'Access Denied', message: tokenVerification.reason });
      }
      authenticatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(tokenVerification.userId);
    }

    if (!authenticatedUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!checkInstitutionAccess(authenticatedUser, doc.institution_id)) {
      return res.status(403).json({ error: 'Access denied: Unauthorized institution access' });
    }

    if (!fs.existsSync(doc.stored_path)) {
      return res.status(404).json({ error: 'Physical file not found in storage repository' });
    }

    recordDocumentAudit({
      documentId: doc.id,
      institutionId: doc.institution_id,
      action: 'FDR_DOCUMENT_DOWNLOADED',
      performedById: authenticatedUser.id,
      performedByName: authenticatedUser.full_name || authenticatedUser.username,
      performedByRole: authenticatedUser.role,
      details: {
        file_name: doc.file_name,
        document_type: doc.document_type
      },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);
    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    return res.sendFile(path.resolve(doc.stored_path));
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * GET /api/fdr/documents/:docId/preview
 * In-browser preview of FDR document
 */
router.get('/documents/:docId/preview', optionalAuth, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM fdr_documents WHERE id = ?').get(req.params.docId);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    let authenticatedUser = req.user;
    const tokenParam = req.query.token;

    if (!authenticatedUser && tokenParam) {
      const tokenVerification = verifySignedDocToken(tokenParam, doc.id);
      if (!tokenVerification.isValid) {
        return res.status(403).json({ error: 'Access Denied', message: tokenVerification.reason });
      }
      authenticatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(tokenVerification.userId);
    }

    if (!authenticatedUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!checkInstitutionAccess(authenticatedUser, doc.institution_id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (!fs.existsSync(doc.stored_path)) {
      return res.status(404).json({ error: 'Physical file not found in repository' });
    }

    res.setHeader('X-AICTE-Watermark-User', authenticatedUser.username);
    res.setHeader('X-AICTE-Watermark-Role', authenticatedUser.role);
    res.setHeader('X-AICTE-Watermark-Timestamp', new Date().toISOString());
    res.setHeader('Content-Type', doc.mime_type || 'application/pdf');

    return res.sendFile(path.resolve(doc.stored_path));
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

/**
 * DELETE /api/fdr/documents/:docId
 * Delete an uploaded document (only allowed if FDR is still in DRAFT status)
 */
router.delete('/documents/:docId', authenticateToken, (req, res) => {
  try {
    const doc = db.prepare('SELECT * FROM fdr_documents WHERE id = ?').get(req.params.docId);
    if (!doc) {
      return errorResponse(res, 'Document not found', 404, 'NOT_FOUND');
    }

    const fdr = db.prepare('SELECT * FROM fdr_records WHERE id = ?').get(doc.fdr_id);
    if (fdr && fdr.status !== 'DRAFT') {
      return errorResponse(res, 'Cannot delete documents once FDR is submitted for verification', 400, 'STATE_LOCKED');
    }

    if (!checkInstitutionAccess(req.user, doc.institution_id)) {
      return errorResponse(res, 'Access denied', 403, 'FORBIDDEN');
    }

    db.prepare('DELETE FROM fdr_documents WHERE id = ?').run(doc.id);
    if (fs.existsSync(doc.stored_path)) {
      fs.unlinkSync(doc.stored_path);
    }

    recordDocumentAudit({
      documentId: doc.id,
      institutionId: doc.institution_id,
      action: 'FDR_DOCUMENT_DELETED',
      performedById: req.user.id,
      performedByName: req.user.full_name || req.user.username,
      performedByRole: req.user.role,
      details: { file_name: doc.file_name, fdr_id: doc.fdr_id },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    return successResponse(res, { id: doc.id }, 'Document removed successfully');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
