const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');
const { initDb } = require('./db');
const { seedDatabase } = require('./seed');
const { startScheduler } = require('./scheduler');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const documentRoutes = require('./routes/documentRoutes');
const commentRoutes = require('./routes/commentRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const { router: securityTestRoutes } = require('./routes/securityTestRoutes');

// Newly integrated statutory lifecycle routes
const workflowRoutes = require('./routes/workflowRoutes');
const scrutinyRoutes = require('./routes/scrutinyRoutes');
const evcRoutes = require('./routes/evcRoutes');
const sacRoutes = require('./routes/sacRoutes');
const decisionRoutes = require('./routes/decisionRoutes');
const undertakingRoutes = require('./routes/undertakingRoutes');
const complianceRoutes = require('./routes/complianceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const escalationRoutes = require('./routes/escalationRoutes');
const institutionRoutes = require('./routes/institutionRoutes');
const reportRoutes = require('./routes/reportRoutes');
const aiRoutes = require('./routes/aiRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// SEC-RULE: Public static serving of private uploads is strictly denied.
// All document access must pass through authorized endpoints (/api/documents/:id/download or /preview).
app.use('/uploads', (req, res) => {
  res.status(403).json({
    success: false,
    error: {
      code: 'DIRECT_ACCESS_FORBIDDEN',
      message: 'Direct access to document repository storage is forbidden. Use authorized API download links.'
    }
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'AICTE Integrated Approval Workflow & Compliance Management System',
    problemStatementId: '26262',
    department: 'AICTE Regulation Bureau',
    version: '3.0.0-GOV',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/security-tests', securityTestRoutes);

// Statutory & Regulatory Modules
app.use('/api/workflows', workflowRoutes);
app.use('/api/scrutiny', scrutinyRoutes);
app.use('/api/evc', evcRoutes);
app.use('/api/sac', sacRoutes);
app.use('/api/decisions', decisionRoutes);
app.use('/api/undertakings', undertakingRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/escalations', escalationRoutes);
app.use('/api/institutions', institutionRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/ai', aiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: err.message || 'An unexpected server error occurred.'
  });
});

// Start server
if (require.main === module) {
  initDb();
  startScheduler();
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`AICTE Integrated Approval Workflow & Compliance System`);
    console.log(`Problem Statement 26262 - Regulation Bureau`);
    console.log(`API Gateway listening on http://localhost:${PORT}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
