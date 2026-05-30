// backend/middleware/communityAuth.js

const Community = require("../models/Community");

// ============================================
// CHECK IF COMMUNITY EXISTS & IS APPROVED
// ============================================
exports.communityExists = async (req, res, next) => {
  try {
    const { communityId } = req.params;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    // Check if community is approved (skip for approval endpoints)
    const skipApprovalCheck =
      req.path.includes("/approve") ||
      req.path.includes("/reject") ||
      req.path.includes("/pending");

    if (!skipApprovalCheck && !community.isApproved) {
      return res.status(403).json({
        success: false,
        message: "This community is pending approval",
      });
    }

    req.community = community;
    next();
  } catch (error) {
    console.error("communityExists error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// CHECK IF USER IS COMMUNITY MEMBER
// ============================================
exports.isCommunityMember = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    if (!community.isMember(userId)) {
      return res.status(403).json({
        success: false,
        message: "You must be a member to perform this action",
      });
    }

    req.community = community;
    next();
  } catch (error) {
    console.error("isCommunityMember error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// CHECK IF USER IS COMMUNITY ADMIN
// ============================================
exports.isCommunityAdmin = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    if (!community.isAdmin(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only community admins can perform this action",
      });
    }

    req.community = community;
    next();
  } catch (error) {
    console.error("isCommunityAdmin error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// CHECK IF USER CAN MANAGE (Admin or Moderator)
// ============================================
exports.canManageCommunity = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    if (!community.canManage(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only admins and moderators can perform this action",
      });
    }

    req.community = community;
    next();
  } catch (error) {
    console.error("canManageCommunity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// CHECK IF USER CAN ACCESS COMMUNITY CONTENT
// (Public: anyone, Private: members only)
// ============================================
exports.canAccessCommunity = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    // Public communities - anyone can access
    if (community.privacy === "public") {
      req.community = community;
      return next();
    }

    // Private communities - only members and admins
    if (community.privacy === "private") {
      if (!community.isMember(userId) && !community.isAdmin(userId)) {
        return res.status(403).json({
          success: false,
          message: "This is a private community. Join to access content.",
          requiresMembership: true,
        });
      }
    }

    req.community = community;
    next();
  } catch (error) {
    console.error("canAccessCommunity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// CHECK IF USER CAN JOIN COMMUNITY
// (Validates community type and approval status)
// ============================================
exports.canJoinCommunity = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    // Check if approved
    if (!community.isApproved) {
      return res.status(400).json({
        success: false,
        message: "Community is pending approval",
      });
    }

    // Check if already a member
    if (community.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: "You are already a member",
      });
    }

    req.community = community;
    next();
  } catch (error) {
    console.error("canJoinCommunity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// CHECK IF USER CAN REQUEST TO JOIN (Private only)
// ============================================
exports.canRequestToJoin = async (req, res, next) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res.status(404).json({
        success: false,
        message: "Community not found",
      });
    }

    // Check if approved
    if (!community.isApproved) {
      return res.status(400).json({
        success: false,
        message: "Community is pending approval",
      });
    }

    // Only private communities need requests
    if (community.privacy !== "private") {
      return res.status(400).json({
        success: false,
        message: "This is a public community. You can join directly.",
        isPublic: true,
      });
    }

    // Check if already a member
    if (community.isMember(userId)) {
      return res.status(400).json({
        success: false,
        message: "You are already a member",
      });
    }

    // Check if already has pending request
    if (community.hasPendingRequest(userId)) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending join request",
      });
    }

    req.community = community;
    next();
  } catch (error) {
    console.error("canRequestToJoin error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
