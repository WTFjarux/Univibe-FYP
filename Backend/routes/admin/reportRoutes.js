// routes/admin/reportRoutes.js

const express = require("express");
const router = express.Router();
const {
  getReports,
  resolveReport,
  dismissReport,
  getReportStats,
  reviewReport,
} = require("../../controllers/admin/reportController");
const { adminProtect } = require("../../middleware/adminAuth");

// All routes require admin authentication
router.use(adminProtect); // Changed from adminAuth to adminProtect

// GET /api/admin/reports - Get all reports with filters
router.get("/", getReports);

//  Stats route MUST come before /:id routes to avoid conflict
router.get("/stats", getReportStats);

// PUT /api/admin/reports/:id/resolve - Resolve a report
router.put("/:id/resolve", resolveReport);

// PUT /api/admin/reports/:id/dismiss - Dismiss a report
router.put("/:id/dismiss", dismissReport);

// PUT /api/admin/reports/:id/review - Mark as reviewing
router.put("/:id/review", reviewReport);

module.exports = router;
