const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
} = require("../../controllers/admin/dashboardController");
const { adminProtect } = require("../../middleware/adminAuth");

// All routes require admin authentication
router.use(adminProtect);

// Dashboard routes
router.get("/stats", getDashboardStats);
router.get("/activity", getRecentActivity);

module.exports = router;
