// backend/routes/admin/userManagementRoutes.js

const express = require("express");
const router = express.Router();
const {
  getUsers,
  getUserDetails,
  warnUser,
  suspendUser,
  unsuspendUser,
  banUser,
  unbanUser,
  forceLogout,
  changeUserRole,
  getUserWarnings,
  revokeWarning,
} = require("../../controllers/admin/userManagementController");
const { adminProtect } = require("../../middleware/adminAuth");

// All routes require admin authentication
router.use(adminProtect);

// ============================================
// USER LISTING & DETAILS
// ============================================

// GET /api/admin/users - List all users with filters
router.get("/", getUsers);

// ============================================
// WARNING MANAGEMENT (MUST be before /:id)
// ============================================

// GET /api/admin/users/:id/warnings - Get warning history
router.get("/:id/warnings", getUserWarnings);

// PUT /api/admin/users/:id/warnings/:warningId/revoke - Revoke a warning
router.put("/:id/warnings/:warningId/revoke", revokeWarning);

// ============================================
// USER DETAILS (AFTER specific routes)
// ============================================

// GET /api/admin/users/:id - Get single user details
router.get("/:id", getUserDetails);

// ============================================
// USER ACTIONS
// ============================================

// PUT /api/admin/users/:id/warn - Issue warning to user
router.put("/:id/warn", warnUser);

// PUT /api/admin/users/:id/suspend - Temporarily suspend user
router.put("/:id/suspend", suspendUser);

// PUT /api/admin/users/:id/unsuspend - Remove suspension early
router.put("/:id/unsuspend", unsuspendUser);

// PUT /api/admin/users/:id/ban - Permanently ban user
router.put("/:id/ban", banUser);

// PUT /api/admin/users/:id/unban - Remove ban
router.put("/:id/unban", unbanUser);

// DELETE /api/admin/users/:id/logout - Force logout user
router.delete("/:id/logout", forceLogout);

// ============================================
// ROLE MANAGEMENT (Super Admin Only)
// ============================================

// PUT /api/admin/users/:id/role - Change user role
router.put("/:id/role", changeUserRole);

module.exports = router;
