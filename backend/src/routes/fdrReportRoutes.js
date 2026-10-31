const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ROLES } = require('../rbac');
const { authenticateToken } = require('../auth');
const { successResponse, errorResponse } = require('../utils/responseHelper');

/**
 * GET /api/fdr-reports/register
 * Comprehensive FDR Register with CSV/JSON export
 */
router.get('/register', authenticateToken, (req, res) => {
  try {
    let whereClause = '1=1';
    const params = [];

    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      whereClause += ' AND f.institution_id = ?';
      params.push(req.user.institution_id);
    } else if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
      whereClause += ' AND i.region = ?';
      params.push(req.user.region);
    }

    const { status, issuing_bank, format = 'json' } = req.query;
    if (status) {
      whereClause += ' AND f.status = ?';
      params.push(status);
    }
    if (issuing_bank) {
      whereClause += ' AND f.issuing_bank LIKE ?';
      params.push(`%${issuing_bank}%`);
    }

    const query = `
      SELECT f.id,
             f.fdr_number,
             i.name as institution_name,
             i.code as institution_code,
             i.region as institution_region,
             i.state as institution_state,
             f.instrument_type,
             f.issuing_bank,
             f.bank_branch,
             f.ifsc_code,
             f.deposit_amount,
             f.currency,
             f.issue_date,
             f.maturity_date,
             f.deposit_holder,
             f.joint_holder_name,
             f.beneficiary,
             f.interest_rate,
             f.lien_marked,
             f.purpose,
             f.status,
             f.verification_status,
             f.submission_date,
             f.verified_by_name,
             f.verified_at
      FROM fdr_records f
      JOIN institutions i ON f.institution_id = i.id
      WHERE ${whereClause}
      ORDER BY f.created_at DESC
    `;

    const records = db.prepare(query).all(...params);

    if (format.toLowerCase() === 'csv') {
      const headers = [
        'FDR Number', 'Institution Code', 'Institution Name', 'Region', 'State',
        'Instrument', 'Issuing Bank', 'Branch', 'IFSC Code', 'Amount (INR)',
        'Issue Date', 'Maturity Date', 'Holder Name', 'Joint Holder',
        'Lien Marked', 'Purpose', 'Status', 'Verification Status', 'Verified At'
      ];

      const csvRows = [
        headers.join(','),
        ...records.map(r => [
          `"${r.fdr_number}"`,
          `"${r.institution_code}"`,
          `"${r.institution_name.replace(/"/g, '""')}"`,
          `"${r.institution_region}"`,
          `"${r.institution_state || ''}"`,
          `"${r.instrument_type}"`,
          `"${r.issuing_bank.replace(/"/g, '""')}"`,
          `"${r.bank_branch.replace(/"/g, '""')}"`,
          `"${r.ifsc_code}"`,
          r.deposit_amount,
          `"${r.issue_date}"`,
          `"${r.maturity_date}"`,
          `"${r.deposit_holder.replace(/"/g, '""')}"`,
          `"${r.joint_holder_name.replace(/"/g, '""')}"`,
          r.lien_marked ? 'YES' : 'NO',
          `"${r.purpose}"`,
          `"${r.status}"`,
          `"${r.verification_status}"`,
          `"${r.verified_at || ''}"`
        ].join(','))
      ];

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="AICTE_FDR_Security_Deposit_Register.csv"');
      return res.status(200).send(csvRows.join('\r\n'));
    }

    return successResponse(res, records, 'FDR Register generated successfully');
  } catch (err) {
    console.error('Error in /api/fdr-reports/register:', err);
    return errorResponse(res, err.message, 500);
  }
});

/**
 * GET /api/fdr-reports/maturity-calendar
 * Monthly timeline of maturing deposits
 */
router.get('/maturity-calendar', authenticateToken, (req, res) => {
  try {
    let whereClause = "f.status NOT IN ('RELEASED', 'ENCASHED', 'FORFEITED')";
    const params = [];

    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      whereClause += ' AND f.institution_id = ?';
      params.push(req.user.institution_id);
    } else if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
      whereClause += ' AND i.region = ?';
      params.push(req.user.region);
    }

    const query = `
      SELECT strftime('%Y-%m', f.maturity_date) as month_period,
             COUNT(*) as fdr_count,
             COALESCE(SUM(f.deposit_amount), 0) as total_amount
      FROM fdr_records f
      JOIN institutions i ON f.institution_id = i.id
      WHERE ${whereClause}
      GROUP BY month_period
      ORDER BY month_period ASC
      LIMIT 24
    `;

    const calendar = db.prepare(query).all(...params);
    return successResponse(res, calendar, 'Maturity calendar generated');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * GET /api/fdr-reports/bank-distribution
 * Bank-wise distribution of security deposits
 */
router.get('/bank-distribution', authenticateToken, (req, res) => {
  try {
    let whereClause = '1=1';
    const params = [];

    if (req.user.role === ROLES.INSTITUTION_ADMIN || req.user.role === ROLES.INSTITUTION_STAFF) {
      whereClause += ' AND f.institution_id = ?';
      params.push(req.user.institution_id);
    } else if (req.user.role === ROLES.REGIONAL_OFFICER && req.user.region) {
      whereClause += ' AND i.region = ?';
      params.push(req.user.region);
    }

    const query = `
      SELECT f.issuing_bank,
             COUNT(*) as count,
             COALESCE(SUM(f.deposit_amount), 0) as total_amount
      FROM fdr_records f
      JOIN institutions i ON f.institution_id = i.id
      WHERE ${whereClause}
      GROUP BY f.issuing_bank
      ORDER BY total_amount DESC
    `;

    const banks = db.prepare(query).all(...params);
    return successResponse(res, banks, 'Bank distribution calculated');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

/**
 * GET /api/fdr-reports/compliance-summary
 * Regional overview of deposit compliance
 */
router.get('/compliance-summary', authenticateToken, (req, res) => {
  try {
    const query = `
      SELECT i.region,
             COUNT(DISTINCT i.id) as total_institutions,
             COUNT(f.id) as total_fdrs,
             COALESCE(SUM(f.deposit_amount), 0) as total_deposit_value,
             SUM(CASE WHEN f.status = 'ACTIVE' THEN 1 ELSE 0 END) as active_fdrs,
             SUM(CASE WHEN f.maturity_date < DATE('now') AND f.status NOT IN ('RELEASED', 'ENCASHED') THEN 1 ELSE 0 END) as overdue_matured_fdrs
      FROM institutions i
      LEFT JOIN fdr_records f ON i.id = f.institution_id
      GROUP BY i.region
      ORDER BY total_deposit_value DESC
    `;

    const summary = db.prepare(query).all();
    return successResponse(res, summary, 'Regional compliance summary generated');
  } catch (err) {
    return errorResponse(res, err.message, 500);
  }
});

module.exports = router;
