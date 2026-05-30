// backend/controllers/communityController.js

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Community = require("../models/Community");
const User = require("../models/User");
const Post = require("../models/Post");
const Event = require("../models/Event");
const Profile = require("../models/Profile");
const ApprovalQueue = require("../models/ApprovalQueue");
const Notification = require("../models/Notification");
const Comment = require("../models/Comment");

// ============================================
// SOCKET HELPERS
// ============================================

/**
 * Emit a notification via socket to a specific user
 * Uses room format: user_{userId} (matches socket/index.js setup)
 */
const emitToUser = async (req, userId, event, data) => {
  try {
    const io = req.app.get("io");
    if (!io) {
      console.error("❌ Socket.io instance not found on app");
      return false;
    }

    const roomName = `user_${userId.toString()}`;
    const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
    const socketCount = socketsInRoom ? socketsInRoom.size : 0;

    console.log(
      `🔍 User ${userId}: ${socketCount} socket(s) in room ${roomName}`,
    );

    if (socketCount > 0) {
      io.to(roomName).emit(event, data);
      console.log(`📤 Emitted ${event} to ${roomName}`);
      return true;
    } else {
      console.log(`⚠️ User ${userId} offline - notification saved to DB only`);
      return false;
    }
  } catch (error) {
    console.error("❌ Socket emit error:", error);
    return false;
  }
};

/**
 * Emit a community update to all members in a community room
 */
const emitCommunityUpdate = (req, communityId, updateType, data) => {
  try {
    const io = req.app.get("io");
    if (io) {
      const room = `community:${communityId}`;
      io.to(room).emit("community:updated", {
        communityId,
        type: updateType,
        data,
      });
      console.log(`📤 Emitted community:updated to ${room}`);
    }
  } catch (error) {
    console.error("Socket community update error:", error);
  }
};

// ============================================
// HELPERS
// ============================================

const getProfileMap = async (userIds) => {
  const profiles = await Profile.find({ user: { $in: userIds } })
    .select("user profilePicture fullName")
    .lean();
  const map = {};
  profiles.forEach((p) => {
    map[p.user.toString()] = p;
  });
  return map;
};

const buildUserMap = async (userIds) => {
  const [users, profileMap] = await Promise.all([
    User.find({ _id: { $in: userIds } })
      .select("name username")
      .lean(),
    getProfileMap(userIds),
  ]);
  const userMap = {};
  users.forEach((user) => {
    const uid = user._id.toString();
    const profile = profileMap[uid];
    userMap[uid] = {
      _id: uid,
      name: profile?.fullName || user.name || "Unknown",
      username: user.username || "user",
      profilePicture: profile?.profilePicture || null,
    };
  });
  userIds.forEach((id) => {
    const uid = id.toString();
    if (!userMap[uid] && profileMap[uid]) {
      userMap[uid] = {
        _id: uid,
        name: profileMap[uid].fullName || "Unknown",
        username: "user",
        profilePicture: profileMap[uid].profilePicture || null,
      };
    }
  });
  return userMap;
};

const buildCommunityMetadata = (community) => ({
  communityId: community._id,
  communityName: community.name,
  communityImage: community.coverImage || null,
});

/**
 * Create notification in DB, populate sender, and emit via socket
 */
const createAndEmitNotification = async (
  req,
  recipientId,
  senderId,
  type,
  title,
  message,
  referenceId,
  referenceModel,
  metadata = {},
) => {
  try {
    // 1. Create notification in database
    const notification = await Notification.create({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      targetId: referenceId,
      targetModel: referenceModel,
      metadata,
    });

    // 2. Populate sender with profile data (matches event controller pattern)
    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", "name username email")
      .lean();

    if (populatedNotification) {
      const senderProfile = await Profile.findOne({
        user: populatedNotification.sender?._id || populatedNotification.sender,
      })
        .select("profilePicture fullName")
        .lean();

      if (senderProfile) {
        populatedNotification.sender = {
          ...populatedNotification.sender,
          profilePicture: senderProfile.profilePicture || null,
          fullName:
            senderProfile.fullName || populatedNotification.sender?.name,
        };
      }
    }

    // 3. Emit socket event
    const emitted = await emitToUser(req, recipientId, "notification:new", {
      notification: populatedNotification,
    });

    // 4. Emit unread count update
    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      read: false,
    });
    await emitToUser(req, recipientId, "notification:unreadCount", {
      count: unreadCount,
    });

    console.log(
      `📧 Notification ${emitted ? "emitted" : "saved"}: ${type} → user ${recipientId}`,
    );
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

/**
 * Send notification to all community admins except the sender
 */
const notifyCommunityAdmins = async (
  req,
  community,
  senderId,
  type,
  title,
  message,
) => {
  const metadata = buildCommunityMetadata(community);

  for (const adminId of community.admins) {
    const adminIdStr = adminId.toString();
    if (adminIdStr !== senderId.toString()) {
      const notification = await Notification.create({
        recipient: adminIdStr,
        sender: senderId,
        type,
        title,
        message,
        targetId: community._id,
        targetModel: "Community",
        metadata,
      });

      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("sender", "name username email")
        .lean();

      if (populatedNotification) {
        const senderProfile = await Profile.findOne({
          user:
            populatedNotification.sender?._id || populatedNotification.sender,
        })
          .select("profilePicture fullName")
          .lean();

        if (senderProfile) {
          populatedNotification.sender = {
            ...populatedNotification.sender,
            profilePicture: senderProfile.profilePicture || null,
            fullName:
              senderProfile.fullName || populatedNotification.sender?.name,
          };
        }
      }

      await emitToUser(req, adminIdStr, "notification:new", {
        notification: populatedNotification,
      });
    }
  }
};

// ============================================
// CREATE COMMUNITY
// ============================================

exports.createCommunity = async (req, res) => {
  try {
    let { name, description, university, type, privacy, tags, rules } =
      req.body;

    if (!name || !university) {
      return res
        .status(400)
        .json({ success: false, message: "Name and university are required" });
    }
    if (name.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Community name must be at least 3 characters",
      });
    }
    if (description && description.length > 500) {
      return res.status(400).json({
        success: false,
        message: "Description must be under 500 characters",
      });
    }

    const communityType = type || "community";
    if (!["community", "department"].includes(communityType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid community type" });
    }

    const communityPrivacy =
      communityType === "department" ? "private" : privacy || "public";

    const existing = await Community.findOne({ name: name.trim(), university });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "A community with this name already exists",
      });
    }

    let parsedTags = [];
    if (tags) {
      try {
        parsedTags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch (e) {
        parsedTags = Array.isArray(tags) ? tags : [];
      }
    }

    let parsedRules = [];
    if (rules) {
      try {
        parsedRules = typeof rules === "string" ? JSON.parse(rules) : rules;
      } catch (e) {
        parsedRules = Array.isArray(rules) ? rules : [];
      }
    }

    const community = new Community({
      name: name.trim(),
      description: description || "",
      university,
      type: communityType,
      privacy: communityPrivacy,
      admins: [req.user.id],
      approvalStatus: "pending",
      tags: parsedTags,
      rules: parsedRules,
    });

    if (req.file) {
      community.coverImage = `/uploads/group-photos/${req.file.filename}`;
    }
    await community.save();

    const approvalEntry = new ApprovalQueue({
      contentType: communityType === "department" ? "department" : "community",
      contentId: community._id,
      contentModel: "Community",
      submittedBy: req.user.id,
      priority: communityType === "department" ? "high" : "normal",
      statusHistory: [
        {
          status: "pending",
          changedBy: req.user.id,
          changedAt: new Date(),
          notes: "Submitted for approval",
        },
      ],
    });

    approvalEntry.contentSnapshot = {
      name: community.name,
      description: community.description || "",
      type: community.type || "community",
      privacy: community.privacy || "public",
      university: community.university,
      coverImage: community.coverImage || null,
      tags: community.tags || [],
      rules: community.rules || [],
      memberCount: community.memberCount || 0,
    };
    await approvalEntry.save();
    await community.populate("admins", "name username profilePicture");

    res.status(201).json({
      success: true,
      message:
        communityType === "department"
          ? "Department created and pending approval"
          : "Community created and pending approval",
      data: community,
    });
  } catch (error) {
    console.error("createCommunity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// REQUEST TO JOIN
// ============================================

exports.requestToJoin = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (community.approvalStatus !== "approved")
      return res
        .status(400)
        .json({ success: false, message: "Community is not yet approved" });
    if (community.privacy !== "private")
      return res.status(400).json({
        success: false,
        message: "This community is public. You can join directly.",
      });
    if (community.isMember(userId))
      return res
        .status(400)
        .json({ success: false, message: "Already a member" });
    if (community.hasPendingRequest(userId))
      return res.status(400).json({
        success: false,
        message: "You already have a pending request",
      });
    if (community.getRequestStatus(userId) === "rejected")
      return res.status(400).json({
        success: false,
        message: "Your previous request was rejected. Contact admin.",
      });

    community.addJoinRequest(userId);
    await community.save();

    await notifyCommunityAdmins(
      req,
      community,
      userId,
      "join_request",
      "New Join Request",
      `${req.user.name || "A user"} wants to join "${community.name}"`,
    );

    res.json({ success: true, message: "Join request sent" });
  } catch (error) {
    console.error("requestToJoin error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET / HANDLE JOIN REQUESTS
// ============================================

exports.getJoinRequests = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (!community.canManage(userId))
      return res.status(403).json({
        success: false,
        message: "Only admins and moderators can view join requests",
      });

    const adminIds = community.admins.map((id) => id.toString());
    const currentMemberIds = new Set(
      community.members.map((m) => m.user.toString()),
    );
    const requestUserIds = community.joinRequests.map((r) => r.user);

    const [profileMap, users, processedByUsers] = await Promise.all([
      getProfileMap(requestUserIds),
      User.find({ _id: { $in: requestUserIds } })
        .select("name username email")
        .lean(),
      User.find({
        _id: {
          $in: community.joinRequests
            .filter((r) => r.processedBy)
            .map((r) => r.processedBy),
        },
      })
        .select("name username")
        .lean(),
    ]);

    const userMap = {};
    users.forEach((u) => {
      userMap[u._id.toString()] = u;
    });
    const processedByMap = {};
    processedByUsers.forEach((u) => {
      processedByMap[u._id.toString()] = u;
    });

    const populatedRequests = community.joinRequests.map((request) => {
      const rid = request.user.toString();
      const user = userMap[rid];
      const profile = profileMap[rid];
      return {
        _id: request._id,
        user: {
          _id: rid,
          name: profile?.fullName || user?.name || "Unknown",
          username: user?.username || "user",
          email: user?.email || "",
          profilePicture: profile?.profilePicture || null,
        },
        requestedAt: request.requestedAt,
        status: request.status,
        processedBy: request.processedBy
          ? processedByMap[request.processedBy.toString()] ||
            request.processedBy
          : null,
        processedAt: request.processedAt,
        rejectionReason: request.rejectionReason,
      };
    });

    const pendingRequests = populatedRequests.filter(
      (r) => r.status === "pending" && !adminIds.includes(r.user._id),
    );
    const processedRequests = populatedRequests
      .filter(
        (r) =>
          r.status !== "pending" &&
          !adminIds.includes(r.user._id) &&
          (currentMemberIds.has(r.user._id) ||
            (r.processedAt &&
              Date.now() - new Date(r.processedAt).getTime() <
                30 * 24 * 60 * 60 * 1000)),
      )
      .slice(-20);

    res.json({
      success: true,
      data: {
        pending: pendingRequests,
        processed: processedRequests,
        pendingCount: pendingRequests.length,
        totalCount: populatedRequests.filter(
          (r) => !adminIds.includes(r.user._id),
        ).length,
      },
    });
  } catch (error) {
    console.error("getJoinRequests error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.handleJoinRequest = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const { action, reason } = req.body;
    const handlerId = req.user.id;

    if (!action || !["approve", "reject"].includes(action))
      return res.status(400).json({
        success: false,
        message: "Action must be 'approve' or 'reject'",
      });
    if (action === "reject" && !reason)
      return res
        .status(400)
        .json({ success: false, message: "Rejection reason is required" });

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (!community.canManage(handlerId))
      return res.status(403).json({
        success: false,
        message: "Only admins and moderators can handle join requests",
      });

    const success =
      action === "approve"
        ? community.approveJoinRequest(userId, handlerId)
        : community.rejectJoinRequest(userId, handlerId, reason);
    if (!success)
      return res
        .status(404)
        .json({ success: false, message: "No pending request found" });
    await community.save();

    const metadata = buildCommunityMetadata(community);

    if (action === "approve") {
      await createAndEmitNotification(
        req,
        userId,
        handlerId,
        "join_approved",
        "Request Approved",
        `Your request to join "${community.name}" has been approved!`,
        community._id,
        "Community",
        metadata,
      );
      emitCommunityUpdate(req, communityId, "member_joined", {
        userId,
        memberCount: community.memberCount,
      });
    } else {
      await createAndEmitNotification(
        req,
        userId,
        handlerId,
        "join_rejected",
        "Request Rejected",
        `Your request to join "${community.name}" was rejected. Reason: ${reason}`,
        community._id,
        "Community",
        metadata,
      );
    }

    res.json({
      success: true,
      message: action === "approve" ? "User approved" : "Request rejected",
      data: {
        memberCount: community.memberCount,
        pendingCount: community.pendingRequestsCount(),
      },
    });
  } catch (error) {
    console.error("handleJoinRequest error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// backend/controllers/communityController.js

// ============================================
// INVITE USER
// ============================================

exports.inviteUser = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { userId: invitedUserId } = req.body;
    const inviterId = req.user.id;

    if (!invitedUserId) {
      return res
        .status(400)
        .json({ success: false, message: "User ID is required" });
    }
    if (invitedUserId === inviterId) {
      return res
        .status(400)
        .json({ success: false, message: "You cannot invite yourself" });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    }
    if (community.approvalStatus !== "approved") {
      return res
        .status(400)
        .json({ success: false, message: "Community is not yet approved" });
    }

    // Check if inviter has permission to invite
    const isInviterMember = community.isMember(inviterId);
    const isInviterAdmin = community.isAdmin(inviterId);
    const isInviterModerator = community.isModerator(inviterId);

    if (!isInviterMember && !isInviterAdmin && !isInviterModerator) {
      return res
        .status(403)
        .json({ success: false, message: "You must be a member to invite" });
    }

    const invitedUser = await User.findById(invitedUserId);
    if (!invitedUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const result = community.inviteUser(invitedUserId, inviterId);
    if (!result.success) {
      return res.status(400).json({ success: false, message: result.message });
    }
    await community.save();

    const metadata = buildCommunityMetadata(community);

    if (result.needsApproval) {
      // ✅ Private community + regular member → Needs admin approval
      // Notify admins about the pending invitation
      await notifyCommunityAdmins(
        req,
        community,
        inviterId,
        "invitation_pending",
        "Invitation Pending Approval",
        `${req.user.name || "A member"} wants to invite ${invitedUser.name} to "${community.name}". Approval required.`,
      );

      // Notify the inviter that approval is pending
      await createAndEmitNotification(
        req,
        inviterId,
        inviterId,
        "invitation_pending",
        "Invitation Pending",
        `Your invitation for ${invitedUser.name} to join "${community.name}" is pending admin approval.`,
        community._id,
        "Community",
        metadata,
      );
    } else {
      // ✅ Direct invitation (public community, or admin/moderator of private)
      // Notify the invited user
      await createAndEmitNotification(
        req,
        invitedUserId,
        inviterId,
        "community_invite",
        "Community Invitation",
        `You have been invited to join "${community.name}". Tap to accept or decline.`,
        community._id,
        "Community",
        metadata,
      );
    }

    res.json({
      success: true,
      message: result.message,
      data: {
        autoJoined: false,
        needsApproval: result.needsApproval || false,
        requiresUserAccept: !result.needsApproval,
        memberCount: community.memberCount,
      },
    });
  } catch (error) {
    console.error("inviteUser error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET MY INVITATIONS
// ============================================

exports.getMyInvitations = async (req, res) => {
  try {
    const userId = req.user.id;
    const communities = await Community.find({
      "invitations.user": userId,
      "invitations.status": "pending",
      isActive: true,
    })
      .populate("invitations.invitedBy", "name username")
      .lean();

    const invitations = communities.map((community) => {
      const invitation = community.invitations.find(
        (inv) => inv.user.toString() === userId && inv.status === "pending",
      );
      return {
        _id: invitation._id,
        community: {
          _id: community._id,
          name: community.name,
          description: community.description,
          coverImage: community.coverImage,
          type: community.type,
          privacy: community.privacy,
          memberCount: community.memberCount,
        },
        invitedBy: invitation.invitedBy,
        invitedAt: invitation.invitedAt,
        status: invitation.status,
      };
    });

    res.json({ success: true, data: invitations, count: invitations.length });
  } catch (error) {
    console.error("getMyInvitations error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// RESPOND TO INVITATION
// ============================================

exports.respondToInvitation = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { action } = req.body;
    const userId = req.user.id;

    if (!action || !["accept", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'accept' or 'reject'",
      });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    }

    const result =
      action === "accept"
        ? community.acceptInvitation(userId)
        : community.rejectInvitation(userId);

    if (!result.success) {
      return res.status(404).json({ success: false, message: result.message });
    }
    await community.save();

    if (action === "accept") {
      // Notify admins that someone accepted
      await notifyCommunityAdmins(
        req,
        community,
        userId,
        "invitation_accepted",
        "Invitation Accepted",
        `${req.user.name || "A user"} accepted the invitation to "${community.name}"`,
      );

      // Emit community update
      emitCommunityUpdate(req, communityId, "member_joined", {
        userId,
        memberCount: community.memberCount,
      });
    }

    res.json({
      success: true,
      message: result.message,
      data: { memberCount: community.memberCount },
    });
  } catch (error) {
    console.error("respondToInvitation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET COMMUNITY INVITATIONS (Admin View)
// ============================================

exports.getCommunityInvitations = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId)
      .populate("invitations.user", "name username email")
      .populate("invitations.invitedBy", "name username");

    if (!community) {
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    }
    if (!community.canManage(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only admins and moderators can view invitations",
      });
    }

    const invitationUserIds = community.invitations.map(
      (inv) => inv.user._id || inv.user,
    );
    const profileMap = await getProfileMap(invitationUserIds);

    const populatedInvitations = community.invitations.map((inv) => {
      const uid = (inv.user._id || inv.user).toString();
      const profile = profileMap[uid];
      return {
        _id: inv._id,
        user: {
          _id: uid,
          name: profile?.fullName || inv.user?.name || "Unknown",
          username: inv.user?.username || "user",
          email: inv.user?.email || "",
          profilePicture: profile?.profilePicture || null,
        },
        invitedBy: inv.invitedBy,
        status: inv.status,
        invitedAt: inv.invitedAt,
      };
    });

    const pendingInvitations = populatedInvitations.filter(
      (inv) => inv.status === "pending",
    );
    const processedInvitations = populatedInvitations
      .filter((inv) => inv.status !== "pending")
      .slice(-20);

    res.json({
      success: true,
      data: {
        pending: pendingInvitations,
        processed: processedInvitations,
        pendingCount: pendingInvitations.length,
      },
    });
  } catch (error) {
    console.error("getCommunityInvitations error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// HANDLE INVITATION (Admin approves/rejects member's invite request)
// ============================================

exports.handleInvitation = async (req, res) => {
  try {
    const { communityId, invitationId } = req.params;
    const { action } = req.body;
    const handlerId = req.user.id;

    if (!action || !["approve", "reject"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Action must be 'approve' or 'reject'",
      });
    }

    const community = await Community.findById(communityId);
    if (!community) {
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    }
    if (!community.canManage(handlerId)) {
      return res.status(403).json({
        success: false,
        message: "Only admins and moderators can handle invitations",
      });
    }

    const invitation = community.invitations.id(invitationId);
    if (!invitation) {
      return res
        .status(404)
        .json({ success: false, message: "Invitation not found" });
    }
    if (invitation.status !== "pending") {
      return res
        .status(400)
        .json({ success: false, message: "Invitation is already processed" });
    }

    const recipientId = invitation.user.toString();
    const metadata = buildCommunityMetadata(community);

    if (action === "approve") {
      // Admin approves the invitation → Send invitation to the user
      // The invitation stays as "pending" for the user to accept
      // But we mark it as approved by admin
      invitation.status = "pending"; // Still pending for user acceptance
      invitation.processedAt = new Date();
      await community.save();

      // Notify the invited user
      await createAndEmitNotification(
        req,
        recipientId,
        handlerId,
        "community_invite",
        "Community Invitation",
        `You have been invited to join "${community.name}". Tap to accept or decline.`,
        community._id,
        "Community",
        metadata,
      );

      // Notify the original inviter that their invitation was approved
      await createAndEmitNotification(
        req,
        invitation.invitedBy.toString(),
        handlerId,
        "invitation_approved",
        "Invitation Approved",
        `Your invitation for a user to join "${community.name}" has been approved. The user will be notified.`,
        community._id,
        "Community",
        metadata,
      );
    } else {
      // Admin rejects the invitation
      invitation.status = "rejected";
      invitation.processedAt = new Date();
      await community.save();

      // Notify the original inviter
      await createAndEmitNotification(
        req,
        invitation.invitedBy.toString(),
        handlerId,
        "invitation_rejected",
        "Invitation Rejected",
        `Your invitation for a user to join "${community.name}" was rejected by an admin.`,
        community._id,
        "Community",
        metadata,
      );
    }

    res.json({
      success: true,
      message:
        action === "approve"
          ? "Invitation approved. User will be notified."
          : "Invitation rejected.",
    });
  } catch (error) {
    console.error("handleInvitation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// UPDATE COMMUNITY
// ============================================

exports.updateCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    // ✅ Destructure all fields from req.body (multer parses these from FormData)
    let { name, description, tags, rules, privacy } = req.body;

    const community = await Community.findById(communityId);
    if (!community) {
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    }
    if (!community.canManage(userId)) {
      return res.status(403).json({
        success: false,
        message: "Only admins and moderators can update",
      });
    }

    // Update name
    if (name && name.trim()) {
      community.name = name.trim();
    }

    // Update description
    if (description !== undefined) {
      community.description = description;
    }

    // ✅ Update privacy - always set if provided
    if (privacy && community.type !== "department") {
      community.privacy = privacy;
    }

    // Update tags
    if (tags) {
      try {
        community.tags = typeof tags === "string" ? JSON.parse(tags) : tags;
      } catch (e) {
        community.tags = tags;
      }
    }

    // Update rules
    if (rules) {
      try {
        community.rules = typeof rules === "string" ? JSON.parse(rules) : rules;
      } catch (e) {
        community.rules = rules;
      }
    }

    // Handle cover image
    if (req.file) {
      try {
        if (community.coverImage) {
          const oldPath = path.join(__dirname, "..", community.coverImage);
          if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        }
      } catch (err) {}
      community.coverImage = `/uploads/group-photos/${req.file.filename}`;
    }

    // Reset rejection status if resubmitting
    if (community.approvalStatus === "rejected") {
      community.approvalStatus = "pending";
      community.rejectionReason = null;
      community.approvedBy = null;
      community.approvedAt = null;
    }

    await community.save();

    // Update approval queue entry
    const approvalEntry = await ApprovalQueue.findOne({
      contentId: communityId,
      contentType: { $in: ["community", "department"] },
    });

    if (approvalEntry) {
      approvalEntry.contentSnapshot.name = community.name;
      approvalEntry.contentSnapshot.description = community.description;
      approvalEntry.contentSnapshot.privacy = community.privacy;
      approvalEntry.contentSnapshot.tags = community.tags || [];
      approvalEntry.contentSnapshot.rules = community.rules || [];
      approvalEntry.contentSnapshot.coverImage = community.coverImage;
      approvalEntry.contentSnapshot.memberCount = community.memberCount;

      if (community.approvalStatus === "pending") {
        approvalEntry.status = "pending";
        approvalEntry.reviewedBy = null;
        approvalEntry.reviewedAt = null;
        approvalEntry.rejectionReason = null;
        approvalEntry.statusHistory.push({
          status: "pending",
          changedBy: userId,
          changedAt: new Date(),
          notes: "Resubmitted after editing",
        });
      }
      await approvalEntry.save();
    }

    // Emit community update via socket
    emitCommunityUpdate(req, communityId, "community_updated", {
      name: community.name,
      description: community.description,
      privacy: community.privacy,
      coverImage: community.coverImage,
    });

    res.json({ success: true, message: "Community updated", data: community });
  } catch (error) {
    console.error("updateCommunity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
// ============================================
// GET ALL / MY / PENDING COMMUNITIES
// ============================================

exports.getAllCommunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const { type, privacy } = req.query;
    const userProfile = await Profile.findOne({ user: userId })
      .select("campus")
      .lean();
    const university = userProfile?.campus;

    const query = { university, isActive: true, approvalStatus: "approved" };
    if (type) query.type = type;
    if (privacy) query.privacy = privacy;

    const communities = await Community.find(query)
      .populate("admins", "name username profilePicture")
      .sort({ name: 1 })
      .lean();

    const result = communities.map((c) => {
      const memberEntry = c.members.find((m) => m.user.toString() === userId);
      return {
        ...c,
        isMember: !!memberEntry,
        isAdmin: c.admins.some((id) => (id._id || id).toString() === userId),
        isModerator: memberEntry?.role === "moderator",
        hasPendingRequest:
          !memberEntry &&
          !c.admins.some((id) => (id._id || id).toString() === userId)
            ? c.joinRequests?.some(
                (r) => r.user.toString() === userId && r.status === "pending",
              )
            : false,
        totalMembers: c.memberCount,
      };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("getAllCommunities error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getMyCommunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const communities = await Community.find({
      $or: [{ "members.user": userId }, { admins: userId }],
      isActive: true,
    })
      .populate("admins", "name username profilePicture")
      .sort({ name: 1 })
      .lean();

    res.json({
      success: true,
      data: communities.map((c) => {
        const memberEntry = c.members.find((m) => m.user.toString() === userId);
        return {
          ...c,
          isMember: !!memberEntry,
          isAdmin: c.admins.some((id) => (id._id || id).toString() === userId),
          isModerator: memberEntry?.role === "moderator",
          hasPendingRequest: false,
          totalMembers: c.memberCount,
        };
      }),
    });
  } catch (error) {
    console.error("getMyCommunities error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getMyPendingCommunities = async (req, res) => {
  try {
    const userId = req.user.id;
    const communities = await Community.find({
      admins: userId,
      approvalStatus: { $in: ["pending", "rejected"] },
      isActive: true,
    })
      .populate("admins", "name username profilePicture")
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      success: true,
      data: communities.map((c) => ({
        ...c,
        approvalStatus: c.approvalStatus,
        rejectionReason: c.rejectionReason || null,
        resubmissionAllowed: false,
      })),
    });
  } catch (error) {
    console.error("getMyPendingCommunities error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET SINGLE COMMUNITY
// ============================================

exports.getCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId)
      .populate("admins", "name username")
      .populate("approvedBy", "name username")
      .lean();
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });

    const adminIds = community.admins.map((a) => a._id.toString());
    const adminProfiles = await getProfileMap(adminIds);
    community.admins = community.admins.map((admin) => {
      const profile = adminProfiles[admin._id.toString()];
      return {
        ...admin,
        name: profile?.fullName || admin.name,
        profilePicture: profile?.profilePicture || null,
      };
    });

    const memberEntry = community.members.find(
      (m) => m.user.toString() === userId,
    );
    const isMember = !!memberEntry;
    const isAdmin = adminIds.includes(userId);
    const isModerator = memberEntry?.role === "moderator";

    if (community.privacy === "private" && !isMember && !isAdmin) {
      community.members = undefined;
    } else if (community.members) {
      const memberIds = community.members.map((m) => m.user.toString());
      const memberProfiles = await getProfileMap(memberIds);
      community.members = community.members.map((m) => {
        const profile = memberProfiles[m.user.toString()];
        return {
          ...m,
          user: {
            _id: m.user.toString(),
            name: profile?.fullName || "Unknown",
            profilePicture: profile?.profilePicture || null,
          },
        };
      });
    }

    const requestStatus =
      community.joinRequests?.find((r) => r.user.toString() === userId)
        ?.status || null;
    const invitationStatus =
      community.invitations?.find((inv) => inv.user.toString() === userId)
        ?.status || null;
    const pendingRequestsCount =
      isAdmin || isModerator
        ? community.joinRequests?.filter(
            (r) =>
              r.status === "pending" && !adminIds.includes(r.user.toString()),
          ).length || 0
        : 0;

    res.json({
      success: true,
      data: {
        ...community,
        isMember,
        isAdmin,
        isModerator,
        requestStatus,
        invitationStatus,
        pendingRequestsCount,
      },
    });
  } catch (error) {
    console.error("getCommunity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// JOIN / LEAVE COMMUNITY
// ============================================

exports.joinCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (community.approvalStatus !== "approved")
      return res
        .status(400)
        .json({ success: false, message: "Community is pending approval" });
    if (community.isMember(userId))
      return res
        .status(400)
        .json({ success: false, message: "Already a member" });
    if (community.privacy === "private")
      return res.status(400).json({
        success: false,
        message: "Private community. Please request to join.",
        requiresRequest: true,
      });

    community.join(userId);
    await community.save();

    await notifyCommunityAdmins(
      req,
      community,
      userId,
      "member_joined",
      "New Member",
      `A new member joined "${community.name}"`,
    );

    res.json({
      success: true,
      message: "Joined successfully",
      data: { memberCount: community.memberCount },
    });
  } catch (error) {
    console.error("joinCommunity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.leaveCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (!community.isMember(userId))
      return res.status(400).json({ success: false, message: "Not a member" });
    if (community.isAdmin(userId))
      return res.status(400).json({
        success: false,
        message: "Admins cannot leave. Transfer admin role first.",
      });

    community.leave(userId);
    await community.save();
    res.json({ success: true, message: "Left community" });
  } catch (error) {
    console.error("leaveCommunity error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// GET MEMBERS
// ============================================

exports.getMembers = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { search } = req.query;
    const userId = req.user.id;

    const community = await Community.findById(communityId).lean();
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });

    const isMember = community.members.some(
      (m) => m.user.toString() === userId,
    );
    const isAdmin = community.admins.some((a) => a.toString() === userId);
    if (community.privacy === "private" && !isMember && !isAdmin)
      return res.status(403).json({
        success: false,
        message: "Only members can view the member list",
      });

    const memberUserIds = community.members.map((m) => m.user);
    const adminIdList = community.admins.map((a) => a.toString());
    const allUserIds = [...new Set([...memberUserIds, ...adminIdList])];
    const userMap = await buildUserMap(allUserIds);
    const adminIdSet = new Set(adminIdList);

    let members = community.members
      .map((m) => {
        const uid = m.user.toString();
        const userData = userMap[uid];
        if (!userData) return null;
        return {
          user: userData,
          joinedAt: m.joinedAt,
          role: m.role || "member",
          isAdmin: adminIdSet.has(uid),
        };
      })
      .filter(Boolean);

    adminIdList.forEach((adminId) => {
      if (!members.some((m) => m.user._id === adminId) && userMap[adminId])
        members.push({
          user: userMap[adminId],
          joinedAt: community.createdAt,
          role: "member",
          isAdmin: true,
        });
    });

    if (search) {
      const q = search.toLowerCase();
      members = members.filter(
        (m) =>
          m.user.name?.toLowerCase().includes(q) ||
          m.user.username?.toLowerCase().includes(q),
      );
    }

    members.sort((a, b) => {
      if (a.isAdmin && !b.isAdmin) return -1;
      if (!a.isAdmin && b.isAdmin) return 1;
      return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
    });

    res.json({ success: true, data: members, count: members.length });
  } catch (error) {
    console.error("getMembers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// REMOVE MEMBER / MODERATOR MANAGEMENT
// ============================================

exports.removeMember = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const removerId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (!community.canManage(removerId))
      return res.status(403).json({
        success: false,
        message: "Only admins and moderators can remove members",
      });

    if (community.isModerator(removerId)) {
      if (community.isAdmin(userId))
        return res
          .status(400)
          .json({ success: false, message: "Moderators cannot remove admins" });
      if (community.isModerator(userId))
        return res.status(400).json({
          success: false,
          message: "Moderators cannot remove other moderators",
        });
    }
    if (
      community.isAdmin(removerId) &&
      community.isAdmin(userId) &&
      community.admins[0].toString() !== removerId
    )
      return res
        .status(400)
        .json({ success: false, message: "Cannot remove another admin" });

    community.removeMember(userId);
    await community.save();

    const metadata = buildCommunityMetadata(community);
    await createAndEmitNotification(
      req,
      userId,
      removerId,
      "member_removed",
      "Removed from Community",
      `You have been removed from "${community.name}"`,
      community._id,
      "Community",
      metadata,
    );
    emitCommunityUpdate(req, communityId, "member_removed", {
      userId,
      memberCount: community.memberCount,
    });

    res.json({ success: true, message: "Member removed" });
  } catch (error) {
    console.error("removeMember error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.addModerator = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const adminId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (!community.isAdmin(adminId))
      return res
        .status(403)
        .json({ success: false, message: "Only admins can add moderators" });
    if (!community.isMember(userId))
      return res
        .status(400)
        .json({ success: false, message: "User is not a member" });

    const member = community.members.find((m) => m.user.toString() === userId);
    if (member) {
      member.role = "moderator";
      await community.save();
    }

    const metadata = buildCommunityMetadata(community);
    await createAndEmitNotification(
      req,
      userId,
      adminId,
      "role_updated",
      "Promoted to Moderator",
      `You have been promoted to moderator in "${community.name}"`,
      community._id,
      "Community",
      metadata,
    );

    res.json({ success: true, message: "Moderator added" });
  } catch (error) {
    console.error("addModerator error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeModerator = async (req, res) => {
  try {
    const { communityId, userId } = req.params;
    const adminId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (!community.isAdmin(adminId))
      return res
        .status(403)
        .json({ success: false, message: "Only admins can remove moderators" });

    const member = community.members.find((m) => m.user.toString() === userId);
    if (member?.role === "moderator") {
      member.role = "member";
      await community.save();
    }

    const metadata = buildCommunityMetadata(community);
    await createAndEmitNotification(
      req,
      userId,
      adminId,
      "role_updated",
      "Moderator Role Removed",
      `Your moderator role in "${community.name}" has been removed`,
      community._id,
      "Community",
      metadata,
    );

    res.json({ success: true, message: "Moderator removed" });
  } catch (error) {
    console.error("removeModerator error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// COMMUNITY FEED & EVENTS
// ============================================

exports.getCommunityFeed = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community) {
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    }

    // ✅ Check access for private communities
    const isMember = community.isMember(userId);
    const isAdmin = community.isAdmin(userId);

    if (community.privacy === "private" && !isMember && !isAdmin) {
      return res
        .status(403)
        .json({ success: false, message: "Join the community to view posts" });
    }

    const posts = await Post.find({
      community: communityId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate("user", "name username email verified")
      .populate("community", "name coverImage type privacy")
      .lean();

    const total = await Post.countDocuments({
      community: communityId,
      isDeleted: false,
    });

    const userIds = posts.map((post) => post.user?._id).filter(Boolean);
    const profiles = await Profile.find({ user: { $in: userIds } })
      .select("user profilePicture")
      .lean();

    const profilePictureMap = {};
    profiles.forEach((p) => {
      profilePictureMap[p.user.toString()] = p.profilePicture || null;
    });

    const postIds = posts.map((post) => post._id);
    const commentCounts = await Comment.aggregate([
      { $match: { post: { $in: postIds }, isDeleted: false } },
      { $group: { _id: "$post", count: { $sum: 1 } } },
    ]);

    const commentCountMap = {};
    commentCounts.forEach((item) => {
      commentCountMap[item._id.toString()] = item.count;
    });

    const enrichedPosts = posts.map((post) => ({
      ...post,
      community: {
        _id: community._id,
        name: community.name,
        coverImage: community.coverImage,
      },
      user: {
        ...post.user,
        profilePicture: profilePictureMap[post.user?._id?.toString()] || null,
      },
      isLiked: post.likes?.some((like) => like.toString() === userId),
      likeCount: post.likes?.length || 0,
      commentCount: commentCountMap[post._id.toString()] || 0,
    }));

    res.json({
      success: true,
      data: enrichedPosts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getCommunityFeed error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getCommunityEvents = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (
      community.privacy === "private" &&
      !community.isMember(userId) &&
      !community.isAdmin(userId)
    )
      return res
        .status(403)
        .json({ success: false, message: "Join the community to view events" });

    const events = await Event.find({ community: communityId })
      .sort({ startDate: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate("organizer", "name username profilePicture")
      .lean();
    const total = await Event.countDocuments({ community: communityId });

    res.json({
      success: true,
      data: events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getCommunityEvents error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ============================================
// SEARCH COMMUNITIES
// ============================================

exports.searchCommunities = async (req, res) => {
  try {
    const { q, type, privacy } = req.query;
    const userId = req.user.id;
    const userProfile = await Profile.findOne({ user: userId })
      .select("campus")
      .lean();
    const university = userProfile?.campus;

    const query = { university, isActive: true, approvalStatus: "approved" };
    if (q)
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { description: { $regex: q, $options: "i" } },
        { tags: { $regex: q, $options: "i" } },
      ];
    if (type) query.type = type;
    if (privacy) query.privacy = privacy;

    const communities = await Community.find(query).sort({ name: 1 }).lean();
    const result = communities.map((c) => {
      const memberEntry = c.members.find((m) => m.user.toString() === userId);
      return {
        ...c,
        isMember: !!memberEntry,
        isAdmin: c.admins.some((id) => (id._id || id).toString() === userId),
        isModerator: memberEntry?.role === "moderator",
        hasPendingRequest:
          c.joinRequests?.some(
            (r) => r.user.toString() === userId && r.status === "pending",
          ) || false,
      };
    });

    res.json({ success: true, data: result, count: result.length });
  } catch (error) {
    console.error("searchCommunities error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
