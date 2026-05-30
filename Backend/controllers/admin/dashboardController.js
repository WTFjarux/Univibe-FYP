// backend/controllers/admin/dashboardController.js

const { getAdminModel } = require("../../config/database");
const User = require("../../models/User");
const Post = require("../../models/Post");
const Comment = require("../../models/Comment");
const Event = require("../../models/Event");
const ApprovalQueue = require("../../models/ApprovalQueue"); // ✅ Main connection

/**
 * Get Dashboard Statistics
 * Includes recent users with profile pictures
 */
const getDashboardStats = async (req, res) => {
  try {
    const Report = getAdminModel("Report");
    const UserWarning = getAdminModel("UserWarning");

    const [
      totalUsers,
      activeUsers,
      bannedUsers,
      totalPosts,
      deletedPosts,
      totalComments,
      deletedComments,
      pendingCommunities,
      pendingEvents,
      pendingReports,
      totalEvents,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isOnline: true }),
      UserWarning.countDocuments({ type: "permanent_ban", isActive: true }),
      Post.countDocuments({ isDeleted: false }),
      Post.countDocuments({ isDeleted: true }),
      Comment.countDocuments({ isDeleted: false }),
      Comment.countDocuments({ isDeleted: true }),
      ApprovalQueue.countDocuments({
        contentType: { $in: ["community", "department"] },
        status: "pending",
      }),
      ApprovalQueue.countDocuments({
        contentType: "event",
        status: "pending",
      }),
      Report.countDocuments({ status: "pending" }),
      Event.countDocuments(),
      User.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("name email username createdAt isOnline")
        .lean(),
    ]);

    const pendingApprovals = pendingCommunities + pendingEvents;

    // Fetch profile pictures for recent users
    if (recentUsers.length > 0) {
      try {
        const Profile = require("../../models/Profile");
        const recentUserIds = recentUsers.map((u) => u._id);

        const profiles = await Profile.find({ user: { $in: recentUserIds } })
          .select("user profilePicture")
          .lean();

        const profileMap = {};
        profiles.forEach((p) => {
          if (p.user) {
            profileMap[p.user.toString()] = p.profilePicture || null;
          }
        });

        recentUsers.forEach((user) => {
          user.profilePicture = profileMap[user._id.toString()] || null;
        });
      } catch (err) {
        console.warn("Failed to fetch profile pictures:", err.message);
        recentUsers.forEach((user) => {
          user.profilePicture = null;
        });
      }
    }

    const [postReports, commentReports, userReports, eventReports] =
      await Promise.all([
        Report.countDocuments({ targetType: "Post", status: "pending" }),
        Report.countDocuments({ targetType: "Comment", status: "pending" }),
        Report.countDocuments({ targetType: "User", status: "pending" }),
        Report.countDocuments({ targetType: "Event", status: "pending" }),
      ]);

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active: activeUsers,
          banned: bannedUsers,
          recent: recentUsers,
        },
        content: { totalPosts, deletedPosts, totalComments, deletedComments },
        moderation: {
          pendingApprovals,
          pendingApprovalsBreakdown: {
            communities: pendingCommunities,
            events: pendingEvents,
          },
          pendingReports,
          reports: {
            total: pendingReports,
            posts: postReports,
            comments: commentReports,
            users: userReports,
            events: eventReports,
          },
        },
        events: { total: totalEvents, pending: pendingEvents },
      },
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};

/**
 * Get Recent Moderation Activity
 */
const getRecentActivity = async (req, res) => {
  try {
    const ModerationLog = getAdminModel("ModerationLog");
    const recentLogs = await ModerationLog.find()
      .populate("admin", "name username")
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({ success: true, data: recentLogs });
  } catch (error) {
    console.error("Recent Activity Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recent activity",
    });
  }
};

module.exports = { getDashboardStats, getRecentActivity };
