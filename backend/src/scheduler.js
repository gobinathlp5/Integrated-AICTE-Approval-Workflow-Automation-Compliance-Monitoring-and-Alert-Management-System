const { db } = require('./db');
const { ROLES } = require('./rbac');
const { v4: uuidv4 } = require('uuid');
const { createNotification } = require('./notificationService');

let intervalHandle = null;

/**
 * Executes automated statutory scan for:
 * 1. Overdue Scrutiny applications (>14 statutory days) -> LEVEL_1 Escalation
 * 2. Overdue EVC inspections (>21 statutory days) -> LEVEL_2 Escalation
 * 3. Expiring statutory undertakings (within 30 days) -> Alert
 * 4. Upcoming annual compliance obligations (within 15 days) -> Reminder
 */
function runScheduledChecks() {
  try {
    let actionsTaken = 0;

    // 1. Overdue Scrutiny Applications
    const pendingScrutiny = db.prepare(`
      SELECT a.*, i.name as institution_name
      FROM applications a
      JOIN institutions i ON a.institution_id = i.id
      WHERE a.status IN ('SCRUTINY', 'UNDER_SCRUTINY') AND a.is_on_hold = 0
    `).all();

    for (const app of pendingScrutiny) {
      const existing = db.prepare(`
        SELECT id FROM escalations
        WHERE application_id = ? AND status = 'OPEN' AND reason LIKE '%Scrutiny%'
      `).get(app.id);

      if (!existing) {
        const escId = 'esc_auto_' + uuidv4().slice(0, 8);
        db.prepare(`
          INSERT INTO escalations (
            id, application_id, institution_id, escalation_level, reason, assigned_to_role, status
          ) VALUES (?, ?, ?, 'LEVEL_1', 'Document Scrutiny review exceeds 14 statutory days', ?, 'OPEN')
        `).run(escId, app.id, app.institution_id, ROLES.REGIONAL_OFFICER);

        createNotification({
          roleTarget: ROLES.REGIONAL_OFFICER,
          title: 'SLA Escalation Alert: Scrutiny Overdue',
          message: `Application ${app.application_number} has exceeded statutory scrutiny turnaround time. Assigned to Regional Officer.`,
          type: 'ESCALATION',
          link: '/escalations'
        });
        actionsTaken++;
      }
    }

    // 2. Overdue EVC Inspections
    const pendingEvc = db.prepare(`
      SELECT a.*, i.name as institution_name
      FROM applications a
      JOIN institutions i ON a.institution_id = i.id
      WHERE a.status IN ('UNDER_EVC', 'EVC_PENDING') AND a.is_on_hold = 0
    `).all();

    for (const app of pendingEvc) {
      const existing = db.prepare(`
        SELECT id FROM escalations
        WHERE application_id = ? AND status = 'OPEN' AND reason LIKE '%EVC%'
      `).get(app.id);

      if (!existing) {
        const escId = 'esc_auto_' + uuidv4().slice(0, 8);
        db.prepare(`
          INSERT INTO escalations (
            id, application_id, institution_id, escalation_level, reason, assigned_to_role, status
          ) VALUES (?, ?, ?, 'LEVEL_2', 'EVC on-site visit report overdue beyond 21 statutory days', ?, 'OPEN')
        `).run(escId, app.id, app.institution_id, ROLES.BUREAU_OFFICER);

        createNotification({
          roleTarget: ROLES.BUREAU_OFFICER,
          title: 'SLA Escalation Alert: EVC Visit Overdue',
          message: `Application ${app.application_number} EVC committee report overdue beyond statutory deadline.`,
          type: 'ESCALATION',
          link: '/escalations'
        });
        actionsTaken++;
      }
    }

    // 3. Expiring Undertakings (within 30 days)
    const expiringUndertakings = db.prepare(`
      SELECT u.*, i.name as institution_name
      FROM undertakings u
      JOIN institutions i ON u.institution_id = i.id
      WHERE u.status = 'VERIFIED'
        AND u.valid_until IS NOT NULL
        AND date(u.valid_until) <= date('now', '+30 days')
        AND date(u.valid_until) >= date('now')
    `).all();

    for (const ut of expiringUndertakings) {
      const existingNotif = db.prepare(`
        SELECT id FROM notifications
        WHERE institution_id = ? AND title LIKE '%Undertaking Expiring%' AND date(created_at) = date('now')
      `).get(ut.institution_id);

      if (!existingNotif) {
        createNotification({
          institutionId: ut.institution_id,
          title: `Statutory Undertaking Expiring Soon: ${ut.title}`,
          message: `Undertaking "${ut.title}" is valid until ${ut.valid_until}. Please submit renewed affidavit before expiry.`,
          type: 'WARNING',
          link: '/undertakings'
        });
        actionsTaken++;
      }
    }

    // 4. Upcoming Compliance Obligations (within 15 days)
    const upcomingObligations = db.prepare(`
      SELECT o.*, i.name as institution_name
      FROM compliance_obligations o
      JOIN institutions i ON o.institution_id = i.id
      WHERE o.status = 'PENDING'
        AND date(o.due_date) <= date('now', '+15 days')
        AND date(o.due_date) >= date('now')
    `).all();

    for (const ob of upcomingObligations) {
      const existingNotif = db.prepare(`
        SELECT id FROM notifications
        WHERE institution_id = ? AND title LIKE '%Compliance Due Soon%' AND date(created_at) = date('now')
      `).get(ob.institution_id);

      if (!existingNotif) {
        createNotification({
          institutionId: ob.institution_id,
          title: `Compliance Due Soon: ${ob.title}`,
          message: `Annual compliance filing for "${ob.title}" is due on ${ob.due_date}. Failure to upload evidence may trigger intake restriction.`,
          type: 'WARNING',
          link: '/compliance'
        });
        actionsTaken++;
      }
    }

    return { success: true, actionsTaken };
  } catch (err) {
    console.error('Scheduled compliance/escalation check failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Starts recurring background scheduler (15-minute interval)
 */
function startScheduler(intervalMs = 15 * 60 * 1000) {
  if (intervalHandle) return;
  // Run initial check
  runScheduledChecks();
  intervalHandle = setInterval(runScheduledChecks, intervalMs);
  console.log(`AICTE Statutory SLA & Compliance Background Scheduler active (interval: ${intervalMs / 1000}s).`);
}

/**
 * Stops background scheduler
 */
function stopScheduler() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  runScheduledChecks,
  startScheduler,
  stopScheduler
};
