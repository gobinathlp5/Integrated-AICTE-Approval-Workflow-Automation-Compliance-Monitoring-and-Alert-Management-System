/**
 * Standardized Canonical API Response Format
 * Conforms to AICTE Enterprise Governance Guidelines:
 * Success: { success: true, message: string, data: any, ...backwardCompatibilityFields }
 * Error:   { success: false, error: { code: string, message: string, details?: any }, message: string }
 */

function successResponse(res, data = {}, message = 'Operation completed successfully', statusCode = 200) {
  const isObject = typeof data === 'object' && !Array.isArray(data) && data !== null;
  const payload = {
    success: true,
    message,
    data,
    ...(isObject ? data : {})
  };
  return res.status(statusCode).json(payload);
}

function errorResponse(res, message = 'An error occurred', statusCode = 400, code = 'BAD_REQUEST', details = null) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {})
    },
    message
  });
}

module.exports = {
  successResponse,
  errorResponse
};
