// backend/routes/communityRoutes.js

const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const communityCtrl = require("../controllers/communityController");
const { uploadCommunityPhoto } = require("../middleware/uploadMiddleware");

// Apply auth middleware to all routes
router.use(protect);

// ============================================
// CREATE & MANAGE
// ============================================
router.post("/", uploadCommunityPhoto, communityCtrl.createCommunity);
router.put(
  "/:communityId",
  uploadCommunityPhoto,
  communityCtrl.updateCommunity,
);
router.delete("/:communityId", communityCtrl.deleteCommunity);

// ============================================
// BROWSE & SEARCH
// ============================================
router.get("/", communityCtrl.getAllCommunities);
router.get("/my", communityCtrl.getMyCommunities);
router.get("/my-pending", communityCtrl.getMyPendingCommunities);
router.get("/search", communityCtrl.searchCommunities);

// ============================================
// INVITATIONS (must be before /:communityId routes)
// ============================================
router.get("/invitations/my", communityCtrl.getMyInvitations);

// ============================================
// SINGLE COMMUNITY
// ============================================
router.get("/:communityId", communityCtrl.getCommunity);

// ============================================
// JOIN / LEAVE
// ============================================
router.post("/:communityId/join", communityCtrl.joinCommunity);
router.post("/:communityId/join-request", communityCtrl.requestToJoin);
router.post("/:communityId/leave", communityCtrl.leaveCommunity);

// ============================================
// INVITATIONS (community-specific)
// ============================================
router.post("/:communityId/invite", communityCtrl.inviteUser);
router.put(
  "/:communityId/invitations/respond",
  communityCtrl.respondToInvitation,
);
router.get("/:communityId/invitations", communityCtrl.getCommunityInvitations);
router.put(
  "/:communityId/invitations/:invitationId",
  communityCtrl.handleInvitation,
);

// ============================================
// JOIN REQUEST MANAGEMENT
// ============================================
router.get("/:communityId/join-requests", communityCtrl.getJoinRequests);
router.put(
  "/:communityId/join-requests/:userId",
  communityCtrl.handleJoinRequest,
);

// ============================================
// MEMBER MANAGEMENT
// ============================================
router.get("/:communityId/members", communityCtrl.getMembers);
router.delete("/:communityId/members/:userId", communityCtrl.removeMember);

// ============================================
// MODERATOR MANAGEMENT
// ============================================
router.put("/:communityId/moderators/:userId", communityCtrl.addModerator);
router.delete(
  "/:communityId/moderators/:userId",
  communityCtrl.removeModerator,
);

// ============================================
// ADMIN MANAGEMENT
// ============================================
router.put("/:communityId/admins/:userId", communityCtrl.addAdmin);
router.delete("/:communityId/admins/:userId", communityCtrl.removeAdmin);
router.put("/:communityId/transfer-admin/:userId", communityCtrl.transferAdmin);

// ============================================
// REPORT
// ============================================
router.post("/:communityId/report", communityCtrl.reportCommunity);

// ============================================
// CONTENT
// ============================================
router.get("/:communityId/feed", communityCtrl.getCommunityFeed);
router.get("/:communityId/events", communityCtrl.getCommunityEvents);

module.exports = router;
