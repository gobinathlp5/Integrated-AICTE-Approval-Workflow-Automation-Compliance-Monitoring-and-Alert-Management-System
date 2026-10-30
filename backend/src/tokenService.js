const crypto = require('crypto');

function getDocTokenSecret() {
  const secret = process.env.DOC_TOKEN_SECRET || process.env.TOKEN_SECRET;
  if (!secret || typeof secret !== 'string' || secret.trim().length === 0) {
    throw new Error('FATAL SECURITY ERROR: DOC_TOKEN_SECRET environment variable is missing. Document token service refuses to operate without a configured secret.');
  }
  if (secret.trim().length < 32) {
    throw new Error('FATAL SECURITY ERROR: DOC_TOKEN_SECRET must be at least 32 characters in length to ensure cryptographic integrity.');
  }
  return secret.trim();
}

/**
 * Generates an HMAC-SHA256 signed temporary download token
 * @param {string} documentId - Document ID
 * @param {string} userId - User ID requesting access
 * @param {number} expiresInSeconds - Expiration window (default: 300s = 5 mins)
 */
function generateSignedDocToken(documentId, userId, expiresInSeconds = 300) {
  const secret = getDocTokenSecret();
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payload = `${documentId}:${userId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  
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
    const secret = getDocTokenSecret();
    const expectedPayload = `${documentId}:${userId}:${expiresAt}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');

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
