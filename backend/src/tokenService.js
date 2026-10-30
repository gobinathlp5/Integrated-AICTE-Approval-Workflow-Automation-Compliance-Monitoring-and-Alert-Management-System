const crypto = require('crypto');

let SECRET_KEY = process.env.DOC_TOKEN_SECRET || process.env.TOKEN_SECRET;
if (!SECRET_KEY) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL SECURITY ERROR: DOC_TOKEN_SECRET environment variable is mandatory in production.');
  }
  SECRET_KEY = 'aicte-secure-signing-key-2026-super-secret-salt';
}

/**
 * Generates an HMAC-SHA256 signed temporary download token
 * @param {string} documentId - Document ID
 * @param {string} userId - User ID requesting access
 * @param {number} expiresInSeconds - Expiration window (default: 300s = 5 mins)
 */
function generateSignedDocToken(documentId, userId, expiresInSeconds = 300) {
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${documentId}:${userId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(payload).digest('hex');
  
  // Base64Url encode token
  const token = Buffer.from(JSON.stringify({ documentId, userId, expiresAt, signature })).toString('base64url');
  return {
    token,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    expiresInSeconds
  };
}

/**
 * Validates a signed download token.
 * Rejects expired tokens or tampered tokens.
 */
function verifySignedDocToken(tokenString, expectedDocumentId = null) {
  try {
    const raw = Buffer.from(tokenString, 'base64url').toString('utf8');
    const { documentId, userId, expiresAt, signature } = JSON.parse(raw);

    if (!documentId || !userId || !expiresAt || !signature) {
      return { isValid: false, reason: 'Malformed token payload' };
    }

    if (expectedDocumentId && documentId !== expectedDocumentId) {
      return { isValid: false, reason: 'Token document ID mismatch' };
    }

    // Verify HMAC signature
    const expectedPayload = `${documentId}:${userId}:${expiresAt}`;
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(expectedPayload).digest('hex');

    if (signature !== expectedSig) {
      return { isValid: false, reason: 'Invalid or forged token cryptographic signature' };
    }

    // Check expiration timestamp
    const now = Math.floor(Date.now() / 1000);
    if (now > expiresAt) {
      return { 
        isValid: false, 
        isExpired: true, 
        reason: `Access link expired at ${new Date(expiresAt * 1000).toISOString()}` 
      };
    }

    return {
      isValid: true,
      documentId,
      userId,
      expiresAt: new Date(expiresAt * 1000).toISOString()
    };
  } catch (err) {
    return { isValid: false, reason: 'Failed to decode signed token' };
  }
}

module.exports = {
  generateSignedDocToken,
  verifySignedDocToken
};
