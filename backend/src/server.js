const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb } = require('./db');
const { seedDatabase } = require('./seed');

const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const documentRoutes = require('./routes/documentRoutes');
const commentRoutes = require('./routes/commentRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const auditRoutes = require('./routes/auditRoutes');
const { router: securityTestRoutes } = require('./routes/securityTestRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploaded files (note: protected downloads should use /api/documents/:id/download)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    system: 'AICTE Centralized Authentication & Access Management Platform',
    version: '2.4.0',
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
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`AICTE Centralized Access Management System`);
    console.log(`API Gateway listening on http://localhost:${PORT}`);
    console.log(`Automated Security Tests available at POST /api/security-tests/run`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
