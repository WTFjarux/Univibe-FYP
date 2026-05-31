// backend/controllers/admin/communityApprovalController.js

const Community = require("../../models/Community");
const ApprovalQueue = require("../../models/ApprovalQueue");
const User = require("../../models/User");
const Profile = require("../../models/Profile");
const Notification = require("../../models/Notification");
const Post = require("../../models/Post");
const { getAdminModel } = require("../../config/database");

// ============================================
// HELPERS
// ============================================

/**
 * Build community metadata for notifications
 */
const buildCommunityMetadata = (community) => ({
  communityId: community._id,
  communityName: community.name,
  communityImage: community.coverImage || null,
});

/**
 * Emit notification via socket to a specific user
 */
const emitToUser = (req, userId, event, data) => {
  try {
    const io = req.app.get("io");
    if (!io) return false;

    const roomName = `user_${userId.toString()}`;
    const socketsInRoom = io.sockets.adapter.rooms.get(roomName);
    const socketCount = socketsInRoom ? socketsInRoom.size : 0;

    if (socketCount > 0) {
      io.to(roomName).emit(event, data);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Socket emit error:", error);
    return false;
  }
};

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

    const populatedNotification = await Notification.findById(notification._id)
      .populate("sender", "name username email")
      .lean();

    if (populatedNotification && populatedNotification.sender) {
      const senderProfile = await Profile.findOne({
        user: populatedNotification.sender._id || populatedNotification.sender,
      })
        .select("profilePicture fullName")
        .lean();

      if (senderProfile) {
        populatedNotification.sender = {
          ...populatedNotification.sender,
          profilePicture: senderProfile.profilePicture || null,
          fullName: senderProfile.fullName || populatedNotification.sender.name,
        };
      }
    }

    await emitToUser(req, recipientId, "notification:new", {
      notification: populatedNotification,
    });

    const unreadCount = await Notification.countDocuments({
      recipient: recipientId,
      read: false,
    });
    await emitToUser(req, recipientId, "notification:unreadCount", {
      count: unreadCount,
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
};

const getAdminIds = (community) => {
  return (community.admins || [])
    .filter((admin) => admin != null)
    .map((admin) => (admin._id ? admin._id.toString() : admin.toString()));
};

/**
 * Notify all community admins (with socket emit)
 */
const notifyAdmins = async (req, community, senderId, type, title, message) => {
  const adminIds = getAdminIds(community);
  const senderStr = senderId ? senderId.toString() : null;
  const metadata = buildCommunityMetadata(community);

  for (const adminIdStr of adminIds) {
    if (adminIdStr !== senderStr) {
      try {
        await createAndEmitNotification(
          req,
          adminIdStr,
          senderId,
          type,
          title,
          message,
          community._id,
          "Community",
          metadata,
        );
      } catch (err) {
        console.error(`Failed to notify admin ${adminIdStr}:`, err);
      }
    }
  }
};

const populateSubmitterProfiles = async (items) => {
  if (!items || items.length === 0) return;
  const userIds = items
    .map((item) => item.submittedBy?._id || item.submittedBy)
    .filter(Boolean);
  if (userIds.length === 0) return;
  const profiles = await Profile.find({ user: { $in: userIds } })
    .select("user profilePicture fullName")
    .lean();
  const profileMap = {};
  profiles.forEach((p) => {
    profileMap[p.user.toString()] = {
      profilePicture: p.profilePicture || null,
      fullName: p.fullName || null,
    };
  });
  items.forEach((item) => {
    if (!item.submittedBy) return;
    const uid = (item.submittedBy._id || item.submittedBy).toString();
    const profile = profileMap[uid];
    if (profile) {
      item.submittedBy.profilePicture = profile.profilePicture;
      if (profile.fullName) item.submittedBy.name = profile.fullName;
    }
  });
};

// ============================================
// GET ALL COMMUNITIES WITH FILTERS
// ============================================
exports.getAllCommunities = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      type,
      university,
      search,
    } = req.query;

    const query = {};
    if (status && status !== "all") query.status = status;
    if (type) query.contentType = type;
    else query.contentType = { $in: ["community", "department"] };
    if (university) query["contentSnapshot.university"] = university;
    if (search) {
      query.$or = [
        { "contentSnapshot.name": { $regex: search, $options: "i" } },
        { "contentSnapshot.description": { $regex: search, $options: "i" } },
      ];
    }

    const total = await ApprovalQueue.countDocuments(query);
    const items = await ApprovalQueue.find(query)
      .populate("submittedBy", "name username email")
      .populate("reviewedBy", "name username")
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    await populateSubmitterProfiles(items);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getAllCommunities error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch communities" });
  }
};

// ============================================
// GET PENDING COMMUNITIES FOR APPROVAL
// ============================================
exports.getPendingCommunities = async (req, res) => {
  try {
    const { page = 1, limit = 20, type, university } = req.query;

    const query = { status: "pending" };
    if (type) query.contentType = type;
    else query.contentType = { $in: ["community", "department"] };
    if (university) query["contentSnapshot.university"] = university;

    const total = await ApprovalQueue.countDocuments(query);
    const items = await ApprovalQueue.find(query)
      .populate("submittedBy", "name username email")
      .sort({ priority: -1, createdAt: 1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    await populateSubmitterProfiles(items);

    res.json({
      success: true,
      data: items,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("getPendingCommunities error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending communities" });
  }
};

// ============================================
// GET PENDING COUNT
// ============================================
exports.getPendingCount = async (req, res) => {
  try {
    const count = await ApprovalQueue.countDocuments({
      contentType: { $in: ["community", "department"] },
      status: "pending",
    });
    res.json({ success: true, data: { pending: count } });
  } catch (error) {
    console.error("getPendingCount error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch pending count" });
  }
};

// ============================================
// GET SINGLE COMMUNITY FOR REVIEW (WITH MEMBERS, POSTS, REPORTS)
// ============================================
exports.getCommunityForReview = async (req, res) => {
  try {
    const { communityId } = req.params;
    const mongoose = require("mongoose");

    const community = await Community.findById(communityId)
      .populate("admins", "name username email")
      .lean();

    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });

    // ============================================
    // ENRICH ADMINS WITH PROFILE PICTURES
    // ============================================
    const adminIds = (community.admins || []).map((a) => a._id);
    if (adminIds.length > 0) {
      const adminProfiles = await Profile.find({ user: { $in: adminIds } })
        .select("user profilePicture fullName")
        .lean();
      const adminProfileMap = {};
      adminProfiles.forEach((p) => {
        adminProfileMap[p.user.toString()] = {
          profilePicture: p.profilePicture,
          fullName: p.fullName,
        };
      });
      community.admins = community.admins.map((admin) => {
        const profile =
          adminProfileMap[admin._id?.toString() || admin.toString()];
        return {
          ...admin,
          name: profile?.fullName || admin.name,
          profilePicture: profile?.profilePicture || null,
        };
      });
    }

    // ============================================
    // ENRICH MEMBERS WITH USER DETAILS & PROFILES
    // ============================================
    if (community.members && community.members.length > 0) {
      const memberUserIds = community.members
        .map((m) => m.user)
        .filter(Boolean);

      if (memberUserIds.length > 0) {
        const [memberUsers, memberProfiles] = await Promise.all([
          User.find({ _id: { $in: memberUserIds } })
            .select("name username email")
            .lean(),
          Profile.find({ user: { $in: memberUserIds } })
            .select("user profilePicture fullName")
            .lean(),
        ]);

        const memberUserMap = {};
        memberUsers.forEach((u) => {
          memberUserMap[u._id.toString()] = u;
        });

        const memberProfileMap = {};
        memberProfiles.forEach((p) => {
          if (p.user) {
            memberProfileMap[p.user.toString()] = {
              profilePicture: p.profilePicture || null,
              fullName: p.fullName || null,
            };
          }
        });

        community.members = community.members.map((member) => {
          const userId = (member.user?._id || member.user).toString();
          const user = memberUserMap[userId] || {};
          const profile = memberProfileMap[userId] || {};

          return {
            ...member,
            user: {
              _id: member.user?._id || member.user,
              name: profile.fullName || user.name || "Unknown",
              username: user.username || "",
              email: user.email || "",
              profilePicture: profile.profilePicture || null,
            },
          };
        });
      }
    }

    // ============================================
    // FETCH COMMUNITY POSTS - TRY BOTH STRING AND OBJECTID
    // ============================================
    console.log(
      "🔍 [getCommunityForReview] Fetching posts for community:",
      communityId,
    );

    // ✅ Use the mongoose that's already required at the top of the file
    let communityObjectId;
    try {
      communityObjectId = new mongoose.Types.ObjectId(communityId);
    } catch (e) {
      communityObjectId = null;
    }

    // ✅ Try BOTH string and ObjectId queries to handle all cases
    const postQuery = {
      $or: [
        { community: communityId }, // string version
      ],
      isDeleted: false,
    };

    // Add ObjectId version if conversion succeeded
    if (communityObjectId) {
      postQuery.$or.push({ community: communityObjectId });
    }

    console.log("📝 Post query $or:", postQuery.$or);

    let posts = await Post.find(postQuery)
      .populate("user", "name username email")
      .populate("community", "name type coverImage")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    console.log(`📝 [getCommunityForReview] Found ${posts.length} posts`);

    // If still no posts, try with includeDeleted
    if (posts.length === 0) {
      console.log(
        "📝 No posts found with isDeleted:false, trying includeDeleted...",
      );
      posts = await Post.find({
        $or: postQuery.$or,
      })
        .includeDeleted()
        .populate("user", "name username email")
        .populate("community", "name type coverImage")
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      // Filter out deleted posts
      posts = posts.filter((p) => !p.isDeleted);
      console.log(`📝 Found ${posts.length} posts with includeDeleted`);
    }

    // If STILL no posts, debug what's in the database
    if (posts.length === 0) {
      console.log("📝 DEBUG: Checking all posts with community field...");
      const anyCommunityPosts = await Post.find({
        community: { $exists: true, $ne: null },
      })
        .includeDeleted()
        .limit(5)
        .lean();

      console.log(
        `📝 Total posts with community field: ${anyCommunityPosts.length}`,
      );
      anyCommunityPosts.forEach((p) => {
        console.log(
          `  - Post ${p._id}: community=${p.community} (type: ${typeof p.community}), isDeleted=${p.isDeleted}`,
        );
      });

      // Try matching by comparing string values
      const communityIdStr = communityId.toString();
      const matchingPosts = anyCommunityPosts.filter(
        (p) => p.community?.toString() === communityIdStr,
      );
      console.log(
        `📝 Posts where community.toString() matches: ${matchingPosts.length}`,
      );

      if (matchingPosts.length > 0) {
        posts = matchingPosts.filter((p) => !p.isDeleted);
      }
    }

    // Debug: Log first post if any
    if (posts.length > 0) {
      console.log("📝 First post sample:", {
        _id: posts[0]._id,
        content: posts[0].content?.substring(0, 50),
        user: posts[0].user?._id,
        community: posts[0].community,
        communityType: typeof posts[0].community,
        isDeleted: posts[0].isDeleted,
      });
    }

    // Enrich posts with profile pictures
    if (posts.length > 0) {
      const postUserIds = [
        ...new Set(
          posts
            .map((p) => p.user?._id)
            .filter(Boolean)
            .map((id) => id.toString()),
        ),
      ];

      if (postUserIds.length > 0) {
        const postProfiles = await Profile.find({
          user: { $in: postUserIds },
        })
          .select("user profilePicture")
          .lean();

        const postProfileMap = {};
        postProfiles.forEach((p) => {
          if (p.user)
            postProfileMap[p.user.toString()] = p.profilePicture || null;
        });

        posts = posts.map((post) => ({
          ...post,
          user: post.user
            ? {
                ...post.user,
                profilePicture: post.user._id
                  ? postProfileMap[post.user._id.toString()] || null
                  : null,
              }
            : null,
        }));
      }
    }

    // ============================================
    // FETCH REPORTS FOR THIS COMMUNITY
    // ============================================
    console.log(
      "🔍 [getCommunityForReview] Fetching reports for community:",
      communityId,
    );
    let reports = [];

    try {
      const Report = getAdminModel("Report");
      if (Report) {
        try {
          const reportTargetId = new mongoose.Types.ObjectId(communityId);
          reports = await Report.find({
            targetType: "Community",
            targetId: reportTargetId,
          })
            .sort({ createdAt: -1 })
            .lean();
        } catch (e) {
          reports = await Report.find({
            targetType: "Community",
            targetId: communityId,
          })
            .sort({ createdAt: -1 })
            .lean();
        }

        console.log(
          `📋 [getCommunityForReview] Found ${reports.length} reports`,
        );

        // Enrich reports with reporter info
        if (reports.length > 0) {
          const reporterIds = [
            ...new Set(reports.map((r) => r.reportedBy).filter(Boolean)),
          ];
          if (reporterIds.length > 0) {
            const [reporters, reporterProfiles] = await Promise.all([
              User.find({ _id: { $in: reporterIds } })
                .select("name username email")
                .lean(),
              Profile.find({ user: { $in: reporterIds } })
                .select("user profilePicture")
                .lean(),
            ]);

            const reporterMap = {};
            reporters.forEach((u) => {
              reporterMap[u._id.toString()] = u;
            });

            const reporterProfileMap = {};
            reporterProfiles.forEach((p) => {
              if (p.user)
                reporterProfileMap[p.user.toString()] =
                  p.profilePicture || null;
            });

            reports = reports.map((report) => ({
              ...report,
              reportedBy: report.reportedBy
                ? {
                    _id: report.reportedBy,
                    name:
                      reporterMap[report.reportedBy.toString()]?.name ||
                      "Unknown",
                    username:
                      reporterMap[report.reportedBy.toString()]?.username || "",
                    email:
                      reporterMap[report.reportedBy.toString()]?.email || "",
                    profilePicture:
                      reporterProfileMap[report.reportedBy.toString()] || null,
                  }
                : null,
            }));
          }
        }
      }
    } catch (err) {
      console.error("Error fetching reports:", err.message);
      reports = [];
    }

    // ============================================
    // GET APPROVAL ENTRY
    // ============================================
    const approvalEntry = await ApprovalQueue.findOne({
      contentId: communityId,
      contentType: { $in: ["community", "department"] },
    })
      .populate("submittedBy", "name username email")
      .populate("reviewedBy", "name username")
      .lean();

    if (approvalEntry) await populateSubmitterProfiles([approvalEntry]);

    // ============================================
    // RETURN RESPONSE
    // ============================================
    res.json({
      success: true,
      data: {
        community,
        approval: approvalEntry,
        posts,
        reports,
        stats: {
          postCount: posts.length,
          reportCount: reports.length,
          memberCount: community.memberCount || community.members?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("getCommunityForReview error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch community details" });
  }
};

// ============================================
// APPROVE COMMUNITY
// ============================================
exports.approveCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { notes } = req.body;
    const adminId = req.user.id;

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (community.approvalStatus === "approved")
      return res
        .status(400)
        .json({ success: false, message: "Already approved" });

    community.approvalStatus = "approved";
    community.approvedBy = adminId;
    community.approvedAt = new Date();
    community.rejectionReason = null;
    await community.save();

    const approvalEntry = await ApprovalQueue.findOne({
      contentId: communityId,
      contentType: { $in: ["community", "department"] },
      status: "pending",
    });

    if (approvalEntry)
      await approvalEntry.approve(adminId, notes || "Community approved");

    const admin = await User.findById(adminId).select("name username");
    const typeLabel =
      community.type === "department" ? "Department" : "Community";

    await notifyAdmins(
      req,
      community,
      adminId,
      "community_approved",
      "Community Approved! 🎉",
      `Your ${typeLabel.toLowerCase()} "${community.name}" has been approved and is now live!`,
    );

    res.json({
      success: true,
      message: `${typeLabel} approved successfully`,
      data: {
        community: {
          _id: community._id,
          name: community.name,
          type: community.type,
          approvalStatus: community.approvalStatus,
          approvedAt: community.approvedAt,
        },
        approvedBy: admin,
      },
    });
  } catch (error) {
    console.error("approveCommunity error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to approve community" });
  }
};

// ============================================
// REJECT COMMUNITY
// ============================================
exports.rejectCommunity = async (req, res) => {
  try {
    const { communityId } = req.params;
    const { reason, allowResubmit } = req.body;
    const adminId = req.user.id;

    if (!reason)
      return res
        .status(400)
        .json({ success: false, message: "Rejection reason is required" });

    const community = await Community.findById(communityId);
    if (!community)
      return res
        .status(404)
        .json({ success: false, message: "Community not found" });
    if (community.approvalStatus === "approved")
      return res
        .status(400)
        .json({ success: false, message: "Already approved" });

    community.approvalStatus = "rejected";
    community.rejectionReason = reason;
    community.approvedBy = adminId;
    community.approvedAt = new Date();
    await community.save();

    const contentType =
      community.type === "department" ? "department" : "community";

    let approvalEntry = await ApprovalQueue.findOne({
      contentId: communityId,
      contentType,
      status: "pending",
    });
    if (!approvalEntry) {
      approvalEntry = await ApprovalQueue.findOne({
        contentId: communityId,
        status: "pending",
      });
    }

    if (approvalEntry) {
      await approvalEntry.reject(adminId, reason, allowResubmit || false);
    } else {
      const newEntry = new ApprovalQueue({
        contentType,
        contentId: communityId,
        contentModel: "Community",
        submittedBy: community.admins[0],
        status: "rejected",
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: reason,
        resubmissionAllowed: allowResubmit || false,
        statusHistory: [
          {
            status: "rejected",
            changedBy: adminId,
            changedAt: new Date(),
            notes: reason,
          },
        ],
      });
      newEntry.createCommunitySnapshot(community);
      await newEntry.save();
    }

    const typeLabel =
      community.type === "department" ? "Department" : "Community";
    const resubmitMsg = allowResubmit
      ? " You may edit and resubmit for approval."
      : "";

    await notifyAdmins(
      req,
      community,
      adminId,
      "community_rejected",
      "Community Rejected",
      `Your ${typeLabel.toLowerCase()} "${community.name}" was rejected. Reason: ${reason}.${resubmitMsg}`,
    );

    res.json({
      success: true,
      message: `${typeLabel} rejected`,
      data: {
        communityId: community._id,
        communityName: community.name,
        approvalStatus: community.approvalStatus,
        rejectionReason: reason,
        allowResubmit: allowResubmit || false,
      },
    });
  } catch (error) {
    console.error("rejectCommunity error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to reject community" });
  }
};

// ============================================
// BULK APPROVE COMMUNITIES
// ============================================
exports.bulkApproveCommunities = async (req, res) => {
  try {
    const { communityIds, notes } = req.body;
    const adminId = req.user.id;

    if (
      !communityIds ||
      !Array.isArray(communityIds) ||
      communityIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Please provide an array of community IDs",
      });
    }

    const results = { approved: [], failed: [] };

    for (const communityId of communityIds) {
      try {
        const community = await Community.findById(communityId);
        if (!community || community.approvalStatus === "approved") {
          results.failed.push({
            id: communityId,
            reason: community ? "Already approved" : "Not found",
          });
          continue;
        }

        community.approvalStatus = "approved";
        community.approvedBy = adminId;
        community.approvedAt = new Date();
        community.rejectionReason = null;
        await community.save();

        const approvalEntry = await ApprovalQueue.findOne({
          contentId: communityId,
          status: "pending",
        });
        if (approvalEntry)
          await approvalEntry.approve(adminId, notes || "Bulk approved");

        const typeLabel =
          community.type === "department" ? "Department" : "Community";

        await notifyAdmins(
          req,
          community,
          adminId,
          "community_approved",
          "Community Approved! 🎉",
          `Your ${typeLabel.toLowerCase()} "${community.name}" has been approved and is now live!`,
        );

        results.approved.push({ id: communityId, name: community.name });
      } catch (err) {
        results.failed.push({ id: communityId, reason: err.message });
      }
    }

    res.json({
      success: true,
      message: `Approved: ${results.approved.length}, Failed: ${results.failed.length}`,
      data: results,
    });
  } catch (error) {
    console.error("bulkApproveCommunities error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to bulk approve communities" });
  }
};

// ============================================
// GET APPROVAL STATISTICS
// ============================================
exports.getApprovalStats = async (req, res) => {
  try {
    const stats = await ApprovalQueue.aggregate([
      { $match: { contentType: { $in: ["community", "department"] } } },
      {
        $group: {
          _id: { status: "$status", type: "$contentType" },
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      total: 0,
      pending: { total: 0, community: 0, department: 0 },
      approved: { total: 0, community: 0, department: 0 },
      rejected: { total: 0, community: 0, department: 0 },
    };

    stats.forEach((stat) => {
      result.total += stat.count;
      if (result[stat._id.status]) {
        result[stat._id.status].total += stat.count;
        result[stat._id.status][stat._id.type] = stat.count;
      }
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("getApprovalStats error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch approval statistics" });
  }
};
