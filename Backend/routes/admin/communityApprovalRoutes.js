// backend/routes/admin/communityApprovalRoutes.js

const express = require("express");
const router = express.Router();
const { adminProtect } = require("../../middleware/adminAuth");
const communityApprovalCtrl = require("../../controllers/admin/communityApprovalController");

// All routes require admin authentication
router.use(adminProtect);

// ============================================
// COMMUNITY APPROVAL ROUTES
// ============================================

// Get all communities with filters (supports ?status=pending|approved|rejected|all)
router.get("/", communityApprovalCtrl.getAllCommunities);

// Get pending communities for approval (legacy)
router.get("/pending", communityApprovalCtrl.getPendingCommunities);

// Get pending count (for dashboard badge)
router.get("/pending/count", communityApprovalCtrl.getPendingCount);

// Get approval statistics
router.get("/stats", communityApprovalCtrl.getApprovalStats);

// Get single community for review
router.get("/:communityId", communityApprovalCtrl.getCommunityForReview);

// Approve community
router.put("/:communityId/approve", communityApprovalCtrl.approveCommunity);

// Reject community
router.put("/:communityId/reject", communityApprovalCtrl.rejectCommunity);

// Bulk approve
router.post("/bulk-approve", communityApprovalCtrl.bulkApproveCommunities);

module.exports = router;
