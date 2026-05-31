// controllers/admin/reportController.js

const { getAdminModel } = require("../../config/database");
const mongoose = require("mongoose");
const Notification = require("../../models/Notification");
const User = require("../../models/User");
const Profile = require("../../models/Profile");
const Post = require("../../models/Post");
const Comment = require("../../models/Comment");
const Event = require("../../models/Event");
const Community = require("../../models/Community");
const { getIO } = require("../../config/socketInstance");

// GET REPORTS
const getReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status = "pending",
      targetType = "all",
      search = "",
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const Report = getAdminModel("Report");

    const query = {};
    if (status !== "all") query.status = status;
    if (targetType !== "all") query.targetType = targetType;

    if (search) {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { username: { $regex: search, $options: "i" } },
        ],
      }).select("_id");
      const userIds = matchingUsers.map((u) => u._id);
      query.$or = [
        { reportedBy: { $in: userIds } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const [reports, total] = await Promise.all([
      Report.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Report.countDocuments(query),
    ]);

    const reporterIds = [
      ...new Set(reports.map((r) => r.reportedBy?.toString()).filter(Boolean)),
    ];
    const resolverIds = [
      ...new Set(reports.map((r) => r.resolvedBy?.toString()).filter(Boolean)),
    ];

    const [reporters, resolvers, profiles] = await Promise.all([
      reporterIds.length > 0
        ? User.find({ _id: { $in: reporterIds } })
            .select("name username email")
            .lean()
        : [],
      resolverIds.length > 0
        ? User.find({ _id: { $in: resolverIds } })
            .select("name username")
            .lean()
        : [],
      reporterIds.length > 0
        ? Profile.find({ user: { $in: reporterIds } })
            .select("user profilePicture")
            .lean()
        : [],
    ]);

    const userMap = {};
    reporters.forEach((u) => {
      userMap[u._id.toString()] = u;
    });
    resolvers.forEach((u) => {
      userMap[u._id.toString()] = { ...userMap[u._id.toString()], ...u };
    });

    const profileMap = {};
    profiles.forEach((p) => {
      if (p.user) profileMap[p.user.toString()] = p.profilePicture || null;
    });

    // Fetch target details
    const targetDetails = await fetchTargetDetails(reports);

    // Enrich reports
    let enrichedReports = reports.map((report) => ({
      ...report,
      reportedBy: report.reportedBy
        ? {
            _id: report.reportedBy,
            name: userMap[report.reportedBy.toString()]?.name || "Unknown User",
            username:
              userMap[report.reportedBy.toString()]?.username || "unknown",
            email: userMap[report.reportedBy.toString()]?.email || "",
            profilePicture: profileMap[report.reportedBy.toString()] || null,
          }
        : null,
      resolvedBy: report.resolvedBy
        ? {
            _id: report.resolvedBy,
            name:
              userMap[report.resolvedBy.toString()]?.name || "Unknown Admin",
            username:
              userMap[report.resolvedBy.toString()]?.username || "unknown",
          }
        : null,
      target:
        targetDetails.get(`${report.targetType}_${report.targetId}`) || null,
    }));

    // ============================================
    // FILTER: Only hide deleted content for PENDING/REVIEWING reports
    // ============================================
    enrichedReports = enrichedReports.filter((report) => {
      // Only filter Posts & Comments
      if (!["Post", "Comment"].includes(report.targetType)) return true;

      // If already resolved or dismissed, ALWAYS show (audit trail)
      if (report.status === "resolved" || report.status === "dismissed")
        return true;

      // For pending/reviewing: hide if target was deleted
      if (!report.target || !report.target.exists) return false;
      if (report.target.isDeleted) return false;

      return true;
    });

    res.status(200).json({
      success: true,
      data: {
        reports: enrichedReports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get Reports Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch reports" });
  }
};

// ============================================
// FETCH TARGET DETAILS
// ============================================
async function fetchTargetDetails(reports) {
  const detailsMap = new Map();
  const targetsByType = {};

  reports.forEach((report) => {
    if (!targetsByType[report.targetType])
      targetsByType[report.targetType] = new Set();
    targetsByType[report.targetType].add(report.targetId.toString());
  });

  for (const [type, ids] of Object.entries(targetsByType)) {
    const idArray = Array.from(ids).map(
      (id) => new mongoose.Types.ObjectId(id),
    );

    try {
      switch (type) {
        case "Post": {
          const posts = await Post.find({ _id: { $in: idArray } })
            .populate("user", "name username email profilePicture")
            .lean();
          const foundPostIds = new Set(posts.map((p) => p._id.toString()));

          const postUserIds = [
            ...new Set(posts.map((p) => p.user?._id).filter(Boolean)),
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
            posts.forEach((post) => {
              if (post.user?._id)
                post.user.profilePicture =
                  postProfileMap[post.user._id.toString()] || null;
            });
          }

          posts.forEach((post) => {
            detailsMap.set(`Post_${post._id}`, {
              _id: post._id,
              content: post.content || "",
              images: post.images || [],
              isAnonymous: post.isAnonymous || false,
              user: post.user || null,
              likes: post.likes || [],
              commentCount: post.commentCount || 0,
              createdAt: post.createdAt,
              isDeleted: post.isDeleted || false,
              visibility: post.visibility || "campus",
              exists: true,
            });
          });

          idArray.forEach((id) => {
            if (!foundPostIds.has(id.toString())) {
              detailsMap.set(`Post_${id}`, {
                _id: id,
                content: "",
                images: [],
                isAnonymous: false,
                user: null,
                likes: [],
                commentCount: 0,
                createdAt: null,
                isDeleted: true,
                visibility: "campus",
                exists: false,
              });
            }
          });
          break;
        }

        case "Comment": {
          const comments = await Comment.find({ _id: { $in: idArray } })
            .populate("user", "name username email")
            .populate("post", "content")
            .lean();
          const foundCommentIds = new Set(
            comments.map((c) => c._id.toString()),
          );

          const commentUserIds = [
            ...new Set(comments.map((c) => c.user?._id).filter(Boolean)),
          ];
          if (commentUserIds.length > 0) {
            const commentProfiles = await Profile.find({
              user: { $in: commentUserIds },
            })
              .select("user profilePicture")
              .lean();
            const commentProfileMap = {};
            commentProfiles.forEach((p) => {
              if (p.user)
                commentProfileMap[p.user.toString()] = p.profilePicture || null;
            });
            comments.forEach((comment) => {
              if (comment.user?._id)
                comment.user.profilePicture =
                  commentProfileMap[comment.user._id.toString()] || null;
            });
          }

          comments.forEach((comment) => {
            detailsMap.set(`Comment_${comment._id}`, {
              _id: comment._id,
              content: comment.content || "",
              user: comment.user || null,
              post: comment.post || null,
              createdAt: comment.createdAt,
              isDeleted: comment.isDeleted || false,
              exists: true,
            });
          });

          idArray.forEach((id) => {
            if (!foundCommentIds.has(id.toString())) {
              detailsMap.set(`Comment_${id}`, {
                _id: id,
                content: "",
                user: { name: "Unknown", username: "unknown" },
                post: null,
                createdAt: null,
                isDeleted: true,
                exists: false,
              });
            }
          });
          break;
        }

        case "User": {
          const users = await User.find({ _id: { $in: idArray } })
            .select("name username email isBanned isSuspended role createdAt")
            .lean();
          const userProfiles = await Profile.find({
            user: { $in: users.map((u) => u._id) },
          })
            .select("user profilePicture")
            .lean();
          const profilePicMap = {};
          userProfiles.forEach((p) => {
            if (p.user)
              profilePicMap[p.user.toString()] = p.profilePicture || null;
          });
          const foundUserIds = new Set(users.map((u) => u._id.toString()));

          users.forEach((user) => {
            detailsMap.set(`User_${user._id}`, {
              _id: user._id,
              name: user.name || "Unknown",
              username: user.username || "",
              email: user.email || "",
              profilePicture: profilePicMap[user._id.toString()] || null,
              isBanned: user.isBanned || false,
              isSuspended: user.isSuspended || false,
              role: user.role || "user",
              createdAt: user.createdAt,
              exists: true,
            });
          });

          idArray.forEach((id) => {
            if (!foundUserIds.has(id.toString())) {
              detailsMap.set(`User_${id}`, {
                _id: id,
                name: "Deleted User",
                username: "deleted",
                email: "",
                profilePicture: null,
                isBanned: false,
                isSuspended: false,
                role: "user",
                createdAt: null,
                exists: false,
              });
            }
          });
          break;
        }

        case "Event": {
          const events = await Event.find({ _id: { $in: idArray } })
            .select(
              "title description startDate endDate location organizer organizerName category status approvalStatus isFeatured",
            )
            .populate("organizer", "name username email")
            
            .lean();
          const foundEventIds = new Set(events.map((e) => e._id.toString()));

          events.forEach((event) => {
            detailsMap.set(`Event_${event._id}`, {
              _id: event._id,
              title: event.title || "",
              description: event.description || "",
              startDate: event.startDate,
              endDate: event.endDate,
              location: event.location || "",
              organizer: event.organizer || null,
              organizerName: event.organizerName || "",
              category: event.category || "",
              status: event.status || "upcoming",
              approvalStatus: event.approvalStatus || "pending",
              isFeatured: event.isFeatured || false,
              exists: true,
            });
          });

          idArray.forEach((id) => {
            if (!foundEventIds.has(id.toString())) {
              detailsMap.set(`Event_${id}`, {
                _id: id,
                title: "Event Deleted",
                description: "",
                startDate: null,
                endDate: null,
                location: "",
                organizer: null,
                organizerName: "",
                category: "",
                status: "cancelled",
                approvalStatus: "rejected",
                isFeatured: false,
                exists: false,
              });
            }
          });
          break;
        }

        case "Community": {
          const communities = await Community.find({ _id: { $in: idArray } })
            .select(
              "name description type privacy memberCount coverImage admins members approvalStatus rules tags createdAt isActive",
            )
            .lean();

          const foundCommunityIds = new Set(
            communities.map((c) => c._id.toString()),
          );

          // Fetch admin details
          const adminIds = communities
            .flatMap((c) => c.admins || [])
            .filter(Boolean);

          const [admins, adminProfiles] = await Promise.all([
            adminIds.length > 0
              ? User.find({ _id: { $in: adminIds } })
                  .select("name username email")
                  .lean()
              : [],
            adminIds.length > 0
              ? Profile.find({ user: { $in: adminIds } })
                  .select("user profilePicture")
                  .lean()
              : [],
          ]);

          const adminMap = {};
          admins.forEach((admin) => {
            adminMap[admin._id.toString()] = admin;
          });

          const adminProfileMap = {};
          adminProfiles.forEach((p) => {
            if (p.user)
              adminProfileMap[p.user.toString()] = p.profilePicture || null;
          });

          // Get moderator details from members array
          const moderatorUserIds = communities
            .flatMap((c) =>
              (c.members || [])
                .filter((m) => m.role === "moderator")
                .map((m) => m.user),
            )
            .filter(Boolean);

          const [moderators, moderatorProfiles] = await Promise.all([
            moderatorUserIds.length > 0
              ? User.find({ _id: { $in: moderatorUserIds } })
                  .select("name username email")
                  .lean()
              : [],
            moderatorUserIds.length > 0
              ? Profile.find({ user: { $in: moderatorUserIds } })
                  .select("user profilePicture")
                  .lean()
              : [],
          ]);

          const moderatorMap = {};
          moderators.forEach((mod) => {
            moderatorMap[mod._id.toString()] = mod;
          });

          const moderatorProfileMap = {};
          moderatorProfiles.forEach((p) => {
            if (p.user)
              moderatorProfileMap[p.user.toString()] = p.profilePicture || null;
          });

          communities.forEach((community) => {
            // Map admin IDs to user objects with profile pictures
            const communityAdmins = (community.admins || []).map((adminId) => {
              const id = adminId.toString();
              const user = adminMap[id];
              return {
                _id: adminId,
                name: user?.name || "Unknown",
                username: user?.username || "unknown",
                email: user?.email || "",
                profilePicture: adminProfileMap[id] || null,
              };
            });

            // Map moderator user IDs to user objects with profile pictures
            const communityModerators = (community.members || [])
              .filter((m) => m.role === "moderator")
              .map((m) => {
                const userId = m.user.toString();
                const user = moderatorMap[userId];
                return {
                  _id: m.user,
                  name: user?.name || "Unknown",
                  username: user?.username || "unknown",
                  email: user?.email || "",
                  profilePicture: moderatorProfileMap[userId] || null,
                };
              });

            detailsMap.set(`Community_${community._id}`, {
              _id: community._id,
              name: community.name || "",
              description: community.description || "",
              type: community.type || "general",
              privacy: community.privacy || "public",
              memberCount: community.memberCount || 0,
              coverImage: community.coverImage || null,
              admin: communityAdmins[0] || null, // First admin
              admins: communityAdmins, // All admins with profile pictures
              moderators: communityModerators, // Moderators with profile pictures
              rules: community.rules || [],
              tags: community.tags || [],
              approvalStatus: community.approvalStatus || "approved",
              createdAt: community.createdAt,
              isDeleted: !community.isActive,
              exists: true,
            });
          });

          idArray.forEach((id) => {
            if (!foundCommunityIds.has(id.toString())) {
              detailsMap.set(`Community_${id}`, {
                _id: id,
                name: "Deleted Community",
                description: "",
                type: "general",
                privacy: "public",
                memberCount: 0,
                coverImage: null,
                admin: null,
                admins: [],
                moderators: [],
                rules: [],
                tags: [],
                approvalStatus: "deleted",
                createdAt: null,
                isDeleted: true,
                exists: false,
              });
            }
          });
          break;
        }

        default:
          idArray.forEach((id) => {
            detailsMap.set(`${type}_${id}`, { _id: id, type, exists: false });
          });
      }
    } catch (err) {
      console.error(`Error fetching ${type} details:`, err.message);
      idArray.forEach((id) => {
        detailsMap.set(`${type}_${id}`, {
          _id: id,
          exists: false,
          error: true,
        });
      });
    }
  }

  return detailsMap;
}

// RESOLVE REPORT
const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, resolutionNote } = req.body;
    const Report = getAdminModel("Report");

    const report = await Report.findById(id);
    if (!report)
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    if (report.status === "resolved" || report.status === "dismissed") {
      return res.status(400).json({
        success: false,
        message: "Report has already been resolved or dismissed",
      });
    }

    report.status = "resolved";
    report.resolvedBy = req.user._id;
    report.resolution = resolution || "no_action";
    report.resolutionNote = resolutionNote || "";
    report.resolvedAt = new Date();
    await report.save();

    // Get target user ID
    let targetUserId = null;
    if (report.targetType === "User") {
      targetUserId = report.targetId;
    } else {
      switch (report.targetType) {
        case "Post":
          const post = await Post.findById(report.targetId)
            .select("user")
            .lean();
          targetUserId = post?.user;
          break;
        case "Comment":
          const comment = await Comment.findById(report.targetId)
            .select("user")
            .lean();
          targetUserId = comment?.user;
          break;
        case "Event":
          const event = await Event.findById(report.targetId)
            .select("organizer")
            .lean();
          targetUserId = event?.organizer;
          break;
        case "Community":
          const community = await Community.findById(report.targetId)
            .select("admins")
            .lean();
          // Get the first admin as the target user
          targetUserId = community?.admins?.[0] || null;
          break;
      }
    }

    // Execute resolution actions
    switch (resolution) {
      case "content_removed":
        await handleContentRemoval(report, req);
        if (targetUserId)
          await issueWarning(
            targetUserId,
            req.user._id,
            report.resolutionNote || "Content removed due to report",
            report._id,
          );
        break;
      case "user_warned":
        if (targetUserId)
          await issueWarning(
            targetUserId,
            req.user._id,
            report.resolutionNote || "Warning issued",
            report._id,
          );
        break;
      case "user_suspended":
        if (targetUserId)
          await suspendTargetUser(
            targetUserId,
            req.user._id,
            report.resolutionNote || "Suspended due to report",
            report._id,
          );
        break;
      case "user_banned":
        if (targetUserId)
          await banTargetUser(
            targetUserId,
            req.user._id,
            report.resolutionNote || "Banned due to report",
            report._id,
          );
        break;
    }

    // Notify reporter
    try {
      await Notification.create({
        recipient: report.reportedBy,
        sender: req.user._id,
        type: "system",
        title: "Report Resolved",
        message: `Your report has been reviewed and resolved.`,
        targetId: report._id,
        targetModel: "Report",
        metadata: {
          reportId: report._id,
          resolution,
          targetType: report.targetType,
          targetId: report.targetId,
        },
      });
    } catch (notifError) {
      console.error("Failed to create notification:", notifError.message);
    }

    // Log moderation action
    try {
      const ModerationLog = getAdminModel("ModerationLog");
      if (ModerationLog?.logAction) {
        await ModerationLog.logAction({
          admin: req.user._id,
          action: "report_resolved",
          targetType: "Report",
          targetId: report._id,
          reason: `${resolution}: ${resolutionNote || ""}`,
          ipAddress: req.ip,
          userAgent: req.headers["user-agent"],
        });
      }
    } catch (logError) {
      console.error("Failed to create moderation log:", logError);
    }

    const resolver = await User.findById(req.user._id)
      .select("name username")
      .lean();

    res.status(200).json({
      success: true,
      message: "Report resolved successfully",
      report: {
        ...report.toObject(),
        resolvedBy: resolver
          ? {
              _id: resolver._id,
              name: resolver.name,
              username: resolver.username,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Resolve Report Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to resolve report" });
  }
};

// HANDLE CONTENT REMOVAL
async function handleContentRemoval(report, req) {
  try {
    switch (report.targetType) {
      case "Post": {
        const post = await Post.findById(report.targetId).includeDeleted();
        if (post && !post.isDeleted) {
          post.isDeleted = true;
          post.deletedAt = new Date();
          post.deletedBy = req.user._id;
          post.deletedByAdmin = true;
          post.deleteReason = report.resolutionNote || "Removed due to report";
          await post.save({ validateModifiedOnly: true });
          await Notification.create({
            recipient: post.user,
            sender: req.user._id,
            type: "post_removed",
            title: "Post Removed",
            message: `Your post was removed: ${report.resolutionNote || "Violation of community guidelines"}`,
            targetId: post._id,
            targetModel: "Post",
          });
        }
        break;
      }
      case "Comment": {
        const comment = await Comment.findById(report.targetId);
        if (comment && !comment.isDeleted) {
          comment.isDeleted = true;
          comment.deletedAt = new Date();
          await comment.save();
          const actualCount = await Comment.countDocuments({
            post: comment.post,
            isDeleted: false,
          });
          await Post.findByIdAndUpdate(comment.post, {
            commentCount: actualCount,
          });
          await Notification.create({
            recipient: comment.user,
            sender: req.user._id,
            type: "system",
            title: "Comment Removed",
            message: `Your comment was removed: ${report.resolutionNote || "Violation of community guidelines"}`,
            targetId: comment._id,
            targetModel: "Comment",
          });
        }
        break;
      }
      case "Event": {
        const event = await Event.findById(report.targetId);
        if (event) {
          event.approvalStatus = "rejected";
          event.rejectionReason =
            report.resolutionNote || "Removed due to report";
          await event.save();
          await Notification.create({
            recipient: event.organizer,
            sender: req.user._id,
            type: "event_rejected",
            title: "Event Removed",
            message: `Your event "${event.title}" was removed: ${report.resolutionNote || "Violation of community guidelines"}`,
            targetId: event._id,
            targetModel: "Event",
          });
        }
        break;
      }
      case "Community": {
        const community = await Community.findById(report.targetId);
        if (community) {
          // Soft delete using isActive field
          community.isActive = false;
          community.approvalStatus = "rejected";
          community.rejectionReason =
            report.resolutionNote || "Removed due to report";
          await community.save();

          // Notify all admins
          if (community.admins && community.admins.length > 0) {
            const adminNotifications = community.admins.map((adminId) => ({
              recipient: adminId,
              sender: req.user._id,
              type: "community_removed",
              title: "Community Removed",
              message: `Your community "${community.name}" was removed: ${report.resolutionNote || "Violation of community guidelines"}`,
              targetId: community._id,
              targetModel: "Community",
            }));
            await Notification.insertMany(adminNotifications);
          }

          // Get moderator IDs from members array
          const moderatorIds = (community.members || [])
            .filter((m) => m.role === "moderator")
            .map((m) => m.user);

          // Notify all moderators
          if (moderatorIds.length > 0) {
            const moderatorNotifications = moderatorIds.map((modId) => ({
              recipient: modId,
              sender: req.user._id,
              type: "community_removed",
              title: "Community Removed",
              message: `The community "${community.name}" (where you were a moderator) was removed: ${report.resolutionNote || "Violation of community guidelines"}`,
              targetId: community._id,
              targetModel: "Community",
            }));
            await Notification.insertMany(moderatorNotifications);
          }
        }
        break;
      }
    }
    console.log(`✅ Content removed: ${report.targetType} ${report.targetId}`);
  } catch (err) {
    console.error(`Failed to remove ${report.targetType}:`, err.message);
  }
}

// ISSUE WARNING
async function issueWarning(userId, adminId, reason, reportId) {
  try {
    const user = await User.findById(userId);
    if (!user || user.role === "admin") return;

    const UserWarning = getAdminModel("UserWarning");
    const warning = await UserWarning.create({
      user: userId,
      issuedBy: adminId,
      type: "warning",
      severity: "medium",
      reason,
      relatedReport: reportId,
      notifyUser: true,
    });
    const activeWarningCount = await UserWarning.countDocuments({
      user: userId,
      isActive: true,
    });

    await Notification.create({
      recipient: userId,
      sender: adminId,
      type: "warning",
      title: "Account Warning",
      message: `You have received a warning: ${reason}`,
      targetId: warning._id,
      targetModel: "UserWarning",
    });

    if (activeWarningCount >= 7) {
      user.isBanned = true;
      user.banReason = `Auto-banned after ${activeWarningCount} warnings`;
      user.bannedAt = new Date();
      user.bannedBy = adminId;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      await Notification.create({
        recipient: userId,
        sender: adminId,
        type: "account_banned",
        title: "Account Banned",
        message: `Auto-banned after ${activeWarningCount} warnings.`,
        targetId: userId,
        targetModel: "User",
      });
      forceUserLogout(
        userId,
        `Auto-banned after ${activeWarningCount} warnings`,
      );
    } else if (activeWarningCount >= 5) {
      user.isSuspended = true;
      user.suspendReason = `Auto-suspended after ${activeWarningCount} warnings`;
      user.suspendedAt = new Date();
      user.suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      await Notification.create({
        recipient: userId,
        sender: adminId,
        type: "account_suspended",
        title: "Account Suspended",
        message: `Suspended for 7 days after ${activeWarningCount} warnings.`,
        targetId: userId,
        targetModel: "User",
      });
      forceUserLogout(
        userId,
        `Suspended for 7 days after ${activeWarningCount} warnings`,
      );
    } else if (activeWarningCount >= 3) {
      user.isSuspended = true;
      user.suspendReason = `Auto-suspended after ${activeWarningCount} warnings`;
      user.suspendedAt = new Date();
      user.suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      await Notification.create({
        recipient: userId,
        sender: adminId,
        type: "account_suspended",
        title: "Account Suspended",
        message: `Suspended for 24 hours after ${activeWarningCount} warnings.`,
        targetId: userId,
        targetModel: "User",
      });
      forceUserLogout(
        userId,
        `Suspended for 24 hours after ${activeWarningCount} warnings`,
      );
    }
    return { warning, activeWarningCount };
  } catch (err) {
    console.error("Failed to issue warning:", err.message);
  }
}

// SUSPEND USER
async function suspendTargetUser(userId, adminId, reason, reportId) {
  try {
    const user = await User.findById(userId);
    if (!user || user.role === "admin") return;

    // Default 24h suspension
    user.isSuspended = true;
    user.suspendReason = reason;
    user.suspendedAt = new Date();
    user.suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    await Notification.create({
      recipient: userId,
      sender: adminId,
      type: "account_suspended",
      title: "Account Suspended",
      message: `Your account has been suspended: ${reason}`,
      targetId: userId,
      targetModel: "User",
    });

    forceUserLogout(userId, `Suspended: ${reason}`);
    console.log(`✅ User suspended: ${userId}`);
  } catch (err) {
    console.error("Failed to suspend user:", err.message);
  }
}

// BAN USER
async function banTargetUser(userId, adminId, reason, reportId) {
  try {
    const user = await User.findById(userId);
    if (!user || user.role === "admin") return;
    user.isBanned = true;
    user.banReason = reason;
    user.bannedAt = new Date();
    user.bannedBy = adminId;
    user.isSuspended = false;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await Notification.create({
      recipient: userId,
      sender: adminId,
      type: "account_banned",
      title: "Account Banned",
      message: `Your account has been permanently banned: ${reason}`,
      targetId: userId,
      targetModel: "User",
    });
    forceUserLogout(userId, reason);
    console.log(`✅ User banned: ${userId}`);
  } catch (err) {
    console.error("Failed to ban user:", err.message);
  }
}

// FORCE LOGOUT
function forceUserLogout(userId, reason) {
  try {
    const io = getIO();
    if (io) {
      io.to(`user_${userId}`).emit("force_logout", {
        message: reason,
        code: "ACCOUNT_BANNED",
      });
    }
  } catch (err) {
    console.error("Force logout error:", err.message);
  }
}

// DISMISS REPORT
const dismissReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    console.log(`🔍 Dismissing report ${id} with reason: ${reason}`);

    const Report = getAdminModel("Report");
    const report = await Report.findById(id);
    if (!report) {
      console.log("❌ Report not found");
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    }

    report.status = "dismissed";
    report.resolvedBy = req.user._id;
    report.resolution = "dismissed";
    report.resolutionNote = reason || "Report dismissed";
    report.resolvedAt = new Date();
    await report.save();

    console.log("✅ Report dismissed successfully");
    res.status(200).json({ success: true, message: "Report dismissed" });
  } catch (error) {
    console.error("Dismiss Report Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to dismiss report" });
  }
};

// GET REPORT STATISTICS
const getReportStats = async (req, res) => {
  try {
    const Report = getAdminModel("Report");
    const stats = await Report.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
          reviewing: {
            $sum: { $cond: [{ $eq: ["$status", "reviewing"] }, 1, 0] },
          },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
          dismissed: {
            $sum: { $cond: [{ $eq: ["$status", "dismissed"] }, 1, 0] },
          },
        },
      },
    ]);
    const byType = await Report.aggregate([
      { $group: { _id: "$targetType", count: { $sum: 1 } } },
    ]);
    res.status(200).json({
      success: true,
      data: {
        summary: stats[0] || {
          total: 0,
          pending: 0,
          reviewing: 0,
          resolved: 0,
          dismissed: 0,
        },
        byType: byType.reduce((acc, curr) => {
          acc[curr._id] = curr.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Get Report Stats Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch statistics" });
  }
};

// REVIEW REPORT
const reviewReport = async (req, res) => {
  try {
    const { id } = req.params;
    const Report = getAdminModel("Report");
    const report = await Report.findById(id);
    if (!report)
      return res
        .status(404)
        .json({ success: false, message: "Report not found" });
    report.status = "reviewing";
    await report.save();
    res.status(200).json({
      success: true,
      message: "Report marked as reviewing",
      report: report.toObject(),
    });
  } catch (error) {
    console.error("Review Report Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update report" });
  }
};

module.exports = {
  getReports,
  resolveReport,
  dismissReport,
  getReportStats,
  reviewReport,
};
