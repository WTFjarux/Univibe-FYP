const User = require("../../models/User");
const { createNotification } = require("../notificationController");
const { getAdminModel } = require("../../config/database");
const { getIO } = require("../../config/socketInstance");

// =============================================================================
// HELPER: Force logout a user via Socket.IO
// =============================================================================
const forceUserLogout = (userId, data) => {
  try {
    const io = getIO();
    if (io && typeof io.forceUserLogout === "function") {
      io.forceUserLogout(userId.toString(), data);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Force logout error:", error.message);
    return false;
  }
};

// =============================================================================
// GET /api/admin/users - Get all users with filters
// =============================================================================
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "all",
      role = "all",
      sort = "newest",
    } = req.query;

    const query = {};

    // Status filter
    if (status === "warned") {
      try {
        const UserWarning = getAdminModel("UserWarning");
        if (UserWarning) {
          const warnedUserIds = await UserWarning.distinct("user", {
            isActive: true,
          });
          const mongoose = require("mongoose");
          query._id = {
            $in: warnedUserIds.map((id) => new mongoose.Types.ObjectId(id)),
          };
          query.isBanned = false;
        }
      } catch (err) {
        console.warn("Failed to get warned users:", err.message);
        return res.status(200).json({
          success: true,
          data: {
            users: [],
            pagination: { page: 1, limit: 20, total: 0, pages: 0 },
          },
        });
      }
    } else if (status === "active") {
      query.isBanned = false;
      query.isSuspended = false;
    } else if (status === "banned") {
      query.isBanned = true;
    } else if (status === "suspended") {
      query.isSuspended = true;
      query.isBanned = false;
    }

    // Role filter
    if (role !== "all") {
      query.role = role;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    // Sort
    let sortOption = {};
    switch (sort) {
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "name":
        sortOption = { name: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password -refreshToken")
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    const userIds = users.map((u) => u._id);

    // Fetch warnings from admin database
    let warningMap = {};
    try {
      const UserWarning = getAdminModel("UserWarning");
      if (UserWarning) {
        const userIdStrings = userIds.map((id) => id.toString());
        const warnings = await UserWarning.aggregate([
          {
            $match: {
              $expr: {
                $and: [
                  { $in: [{ $toString: "$user" }, userIdStrings] },
                  { $eq: ["$isActive", true] },
                ],
              },
            },
          },
          { $group: { _id: "$user", count: { $sum: 1 } } },
        ]);

        warnings.forEach((w) => {
          warningMap[w._id.toString()] = w.count;
        });
      }
    } catch (err) {
      console.warn("Warning count error:", err.message);
    }

    // Fetch profiles from main database
    let profileMap = {};
    try {
      const Profile = require("../../models/Profile");
      const profiles = await Profile.find({ user: { $in: userIds } })
        .select("user profilePicture")
        .lean();

      profiles.forEach((p) => {
        if (p.user) {
          profileMap[p.user.toString()] = p.profilePicture || null;
        }
      });
    } catch (err) {
      console.warn("Profile fetch error:", err.message);
    }

    // Enhance user data
    const enhancedUsers = users.map((user) => ({
      ...user,
      warningCount: warningMap[user._id.toString()] || 0,
      profilePicture: profileMap[user._id.toString()] || null,
      status: user.isBanned
        ? "banned"
        : user.isSuspended
          ? "suspended"
          : (warningMap[user._id.toString()] || 0) > 0
            ? "warned"
            : "active",
    }));

    res.status(200).json({
      success: true,
      data: {
        users: enhancedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};

// =============================================================================
// GET /api/admin/users/:id - Get single user details
// =============================================================================
const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password -refreshToken")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get profile from main database
    let profile = null;
    try {
      const Profile = require("../../models/Profile");
      profile = await Profile.findOne({ user: user._id }).lean();
    } catch (err) {
      console.warn("Profile fetch error:", err.message);
    }

    // Get warning history from admin database
    let warnings = [];
    try {
      const UserWarning = getAdminModel("UserWarning");
      if (UserWarning) {
        warnings = await UserWarning.find({ user: user._id })
          .sort({ createdAt: -1 })
          .lean();

        // Manually populate issuedBy names
        const issuerIds = [
          ...new Set(
            warnings.map((w) => w.issuedBy?.toString()).filter(Boolean),
          ),
        ];

        if (issuerIds.length > 0) {
          const issuers = await User.find({ _id: { $in: issuerIds } })
            .select("name username")
            .lean();

          const issuerMap = {};
          issuers.forEach((i) => {
            issuerMap[i._id.toString()] = {
              name: i.name,
              username: i.username,
            };
          });

          warnings = warnings.map((w) => ({
            ...w,
            issuedBy: w.issuedBy
              ? issuerMap[w.issuedBy.toString()] || {
                  name: "Unknown",
                  username: "unknown",
                }
              : { name: "System", username: "system" },
          }));
        }
      }
    } catch (err) {
      console.warn("UserWarning fetch error:", err.message);
    }

    // Get reports from admin database
    let reports = [];
    try {
      const Report = getAdminModel("Report");
      if (Report) {
        reports = await Report.find({ targetType: "User", targetId: user._id })
          .sort({ createdAt: -1 })
          .lean();

        const reporterIds = [
          ...new Set(
            reports.map((r) => r.reportedBy?.toString()).filter(Boolean),
          ),
        ];

        if (reporterIds.length > 0) {
          const reporters = await User.find({ _id: { $in: reporterIds } })
            .select("name username")
            .lean();

          const reporterMap = {};
          reporters.forEach((r) => {
            reporterMap[r._id.toString()] = {
              name: r.name,
              username: r.username,
            };
          });

          reports = reports.map((r) => ({
            ...r,
            reportedBy: r.reportedBy
              ? reporterMap[r.reportedBy.toString()] || {
                  name: "Unknown",
                  username: "unknown",
                }
              : { name: "Unknown", username: "unknown" },
          }));
        }
      }
    } catch (err) {
      console.warn("Report fetch error:", err.message);
    }

    // ============================================
    // 🔥 FETCH ACTUAL POSTS
    // ============================================
    let posts = [];
    let postCount = 0;
    try {
      const Post = require("../../models/Post");
      [posts, postCount] = await Promise.all([
        Post.find({
          user: user._id,
          isDeleted: false,
          isAnonymous: { $ne: true },
        })
          .select(
            "content images likes commentCount createdAt visibility isAnonymous",
          )
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        Post.countDocuments({
          user: user._id,
          isDeleted: false,
          isAnonymous: { $ne: true },
        }),
      ]);
    } catch (err) {
      console.warn("Posts fetch error:", err.message);
    }

    // ============================================
    // 🔥 FETCH ACTUAL COMMENTS
    // ============================================
    let comments = [];
    let commentCount = 0;
    try {
      const Comment = require("../../models/Comment");
      [comments, commentCount] = await Promise.all([
        Comment.find({ user: user._id, isDeleted: false })
          .select("content post createdAt")
          .populate("post", "content")
          .sort({ createdAt: -1 })
          .limit(10)
          .lean(),
        Comment.countDocuments({ user: user._id, isDeleted: false }),
      ]);
    } catch (err) {
      console.warn("Comments fetch error:", err.message);
    }

    res.status(200).json({
      success: true,
      data: {
        user: { ...user, profilePicture: profile?.profilePicture || null },
        warnings,
        reports,
        posts,
        comments,
        stats: {
          postCount,
          commentCount,
          warningCount: warnings.filter((w) => w.isActive).length,
          reportCount: reports.filter((r) => r.status === "pending").length,
        },
      },
    });
  } catch (error) {
    console.error("Get User Details Error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch user details",
    });
  }
};

// =============================================================================
// PUT /api/admin/users/:id/warn - Issue warning to user
// =============================================================================
const warnUser = async (req, res) => {
  try {
    const { reason, severity = "medium", relatedContent } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Reason is required" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Cannot warn admin users" });
    }

    // Create warning
    const UserWarning = getAdminModel("UserWarning");
    const warning = await UserWarning.create({
      user: user._id,
      issuedBy: req.user._id,
      type: "warning",
      severity,
      reason,
      relatedContent: relatedContent || undefined,
      notifyUser: true,
    });

    // Send notification
    await createNotification(
      user._id,
      req.user._id,
      "warning",
      "Account Warning",
      `You have received a warning: ${reason}`,
      warning._id,
      "UserWarning",
    );

    // Check auto-escalation
    const activeWarningCount = await UserWarning.countDocuments({
      user: user._id,
      isActive: true,
    });

    let escalationMessage = "";
    let autoAction = null;

    if (activeWarningCount >= 7) {
      user.isBanned = true;
      user.banReason = `Auto-banned after ${activeWarningCount} warnings`;
      user.bannedAt = new Date();
      user.bannedBy = req.user._id;
      user.refreshToken = undefined;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      await createNotification(
        user._id,
        req.user._id,
        "account_banned",
        "Account Banned",
        `Your account has been automatically banned after receiving ${activeWarningCount} warnings.`,
        user._id,
        "User",
      );

      // Force logout
      forceUserLogout(user._id, {
        message: `Your account has been automatically banned after ${activeWarningCount} warnings.`,
        code: "ACCOUNT_BANNED",
        reason: `Auto-banned after ${activeWarningCount} warnings`,
      });

      escalationMessage =
        "User has been automatically banned after 7 warnings.";
      autoAction = "banned";
    } else if (activeWarningCount >= 5) {
      user.isSuspended = true;
      user.suspendReason = `Auto-suspended after ${activeWarningCount} warnings`;
      user.suspendedAt = new Date();
      user.suspendedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      user.refreshToken = undefined;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      await createNotification(
        user._id,
        req.user._id,
        "account_suspended",
        "Account Suspended",
        `Your account has been automatically suspended for 7 days after receiving ${activeWarningCount} warnings.`,
        user._id,
        "User",
      );

      // Force logout
      forceUserLogout(user._id, {
        message: `Your account has been suspended for 7 days after ${activeWarningCount} warnings.`,
        code: "ACCOUNT_SUSPENDED",
        reason: `Auto-suspended after ${activeWarningCount} warnings`,
      });

      escalationMessage =
        "User has been automatically suspended for 7 days after 5 warnings.";
      autoAction = "suspended_7d";
    } else if (activeWarningCount >= 3) {
      user.isSuspended = true;
      user.suspendReason = `Auto-suspended after ${activeWarningCount} warnings`;
      user.suspendedAt = new Date();
      user.suspendedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      user.refreshToken = undefined;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();

      await createNotification(
        user._id,
        req.user._id,
        "account_suspended",
        "Account Suspended",
        `Your account has been automatically suspended for 24 hours after receiving ${activeWarningCount} warnings.`,
        user._id,
        "User",
      );

      // Force logout
      forceUserLogout(user._id, {
        message: `Your account has been suspended for 24 hours after ${activeWarningCount} warnings.`,
        code: "ACCOUNT_SUSPENDED",
        reason: `Auto-suspended after ${activeWarningCount} warnings`,
      });

      escalationMessage =
        "User has been automatically suspended for 24 hours after 3 warnings.";
      autoAction = "suspended_24h";
    }

    // Log moderation action
    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "user_warned",
      targetType: "User",
      targetId: user._id,
      reason,
      details: {
        severity,
        warningCount: activeWarningCount,
        escalation: escalationMessage,
        autoAction,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      message: escalationMessage || "Warning issued successfully",
      data: {
        warning,
        warningCount: activeWarningCount,
        escalation: escalationMessage || null,
        autoAction,
      },
    });
  } catch (error) {
    console.error("Warn User Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to issue warning" });
  }
};

// =============================================================================
// PUT /api/admin/users/:id/suspend - Suspend user temporarily
// =============================================================================
const suspendUser = async (req, res) => {
  try {
    const { reason, duration } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Reason is required" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Cannot suspend admin users" });
    }

    const suspendHours = parseInt(duration) || 24;

    user.isSuspended = true;
    user.suspendReason = reason;
    user.suspendedAt = new Date();
    user.suspendedUntil = new Date(Date.now() + suspendHours * 60 * 60 * 1000);
    user.refreshToken = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Send notification
    await createNotification(
      user._id,
      req.user._id,
      "account_suspended",
      "Account Suspended",
      `Your account has been suspended for ${suspendHours} hours: ${reason}`,
      user._id,
      "User",
    );

    // Force logout
    forceUserLogout(user._id, {
      message: `Your account has been suspended for ${suspendHours} hours. Reason: ${reason}`,
      code: "ACCOUNT_SUSPENDED",
      reason,
    });

    // Log action
    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "user_suspended",
      targetType: "User",
      targetId: user._id,
      reason,
      details: { duration: suspendHours },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      message: `User suspended for ${suspendHours} hours`,
    });
  } catch (error) {
    console.error("Suspend User Error:", error);
    res.status(500).json({ success: false, message: "Failed to suspend user" });
  }
};

// =============================================================================
// PUT /api/admin/users/:id/unsuspend - Remove suspension early
// =============================================================================
const unsuspendUser = async (req, res) => {
  try {
    const { reason } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.isSuspended) {
      return res
        .status(400)
        .json({ success: false, message: "User is not suspended" });
    }

    user.isSuspended = false;
    user.suspendReason = undefined;
    user.suspendedAt = undefined;
    user.suspendedUntil = undefined;
    await user.save();

    await createNotification(
      user._id,
      req.user._id,
      "account_reactivated",
      "Account Reactivated",
      `Your account suspension has been lifted${reason ? `: ${reason}` : "."}`,
      user._id,
      "User",
    );

    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "user_unsuspended",
      targetType: "User",
      targetId: user._id,
      reason: reason || "Manual unsuspension",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res
      .status(200)
      .json({ success: true, message: "User unsuspended successfully" });
  } catch (error) {
    console.error("Unsuspend User Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to unsuspend user" });
  }
};

// =============================================================================
// PUT /api/admin/users/:id/ban - Ban user permanently
// =============================================================================
const banUser = async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason) {
      return res
        .status(400)
        .json({ success: false, message: "Reason is required" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.role === "admin") {
      return res
        .status(403)
        .json({ success: false, message: "Cannot ban admin users" });
    }

    user.isBanned = true;
    user.banReason = reason;
    user.bannedAt = new Date();
    user.bannedBy = req.user._id;
    user.isSuspended = false;
    user.refreshToken = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Send notification
    await createNotification(
      user._id,
      req.user._id,
      "account_banned",
      "Account Banned",
      `Your account has been permanently banned: ${reason}`,
      user._id,
      "User",
    );

    // Force logout via Socket.IO
    forceUserLogout(user._id, {
      message: `Your account has been permanently banned. Reason: ${reason}`,
      code: "ACCOUNT_BANNED",
      reason,
    });

    // Log action
    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "user_banned",
      targetType: "User",
      targetId: user._id,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res
      .status(200)
      .json({ success: true, message: "User banned successfully" });
  } catch (error) {
    console.error("Ban User Error:", error);
    res.status(500).json({ success: false, message: "Failed to ban user" });
  }
};

// =============================================================================
// PUT /api/admin/users/:id/unban - Unban user
// =============================================================================
const unbanUser = async (req, res) => {
  try {
    const { reason } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.isBanned) {
      return res
        .status(400)
        .json({ success: false, message: "User is not banned" });
    }

    user.isBanned = false;
    user.isSuspended = false;
    user.banReason = undefined;
    user.suspendReason = undefined;
    user.bannedAt = undefined;
    user.suspendedAt = undefined;
    user.suspendedUntil = undefined;
    await user.save();

    await createNotification(
      user._id,
      req.user._id,
      "account_unbanned",
      "Account Unbanned",
      `Your account has been unbanned${reason ? `: ${reason}` : "."}`,
      user._id,
      "User",
    );

    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "user_unbanned",
      targetType: "User",
      targetId: user._id,
      reason: reason || "Manual unban",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res
      .status(200)
      .json({ success: true, message: "User unbanned successfully" });
  } catch (error) {
    console.error("Unban User Error:", error);
    res.status(500).json({ success: false, message: "Failed to unban user" });
  }
};

// =============================================================================
// DELETE /api/admin/users/:id/logout - Force logout user
// =============================================================================
const forceLogout = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    user.tokenVersion = (user.tokenVersion || 0) + 1;
    user.refreshToken = undefined;
    await user.save();

    // Force logout via socket
    forceUserLogout(user._id, {
      message: "You have been logged out by an administrator.",
      code: "FORCE_LOGOUT",
    });

    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "user_force_logout",
      targetType: "User",
      targetId: user._id,
      reason: "Force logout by admin",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res
      .status(200)
      .json({ success: true, message: "User logged out from all devices" });
  } catch (error) {
    console.error("Force Logout Error:", error);
    res.status(500).json({ success: false, message: "Failed to logout user" });
  }
};

// =============================================================================
// PUT /api/admin/users/:id/role - Change user role
// =============================================================================
const changeUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!role || !["user", "moderator", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Valid role is required (user, moderator, admin)",
      });
    }

    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only super admins can change roles",
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const oldRole = user.role;
    user.role = role;
    await user.save();

    await createNotification(
      user._id,
      req.user._id,
      "system",
      "Role Updated",
      `Your account role has been changed from ${oldRole} to ${role}.`,
      user._id,
      "User",
    );

    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "user_role_changed",
      targetType: "User",
      targetId: user._id,
      reason: `Role changed from ${oldRole} to ${role}`,
      details: { oldRole, newRole: role },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res
      .status(200)
      .json({ success: true, message: `User role changed to ${role}` });
  } catch (error) {
    console.error("Change Role Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to change user role" });
  }
};

// =============================================================================
// GET /api/admin/users/:id/warnings - Get user warning history
// =============================================================================
const getUserWarnings = async (req, res) => {
  try {
    const UserWarning = getAdminModel("UserWarning");

    // Instead of using .populate() which fails across databases,
    // fetch warnings without populate first
    const warnings = await UserWarning.find({ user: req.params.id })
      .sort({ createdAt: -1 })
      .lean();

    // Manually populate issuedBy names - same pattern used in getUserDetails
    const issuerIds = [
      ...new Set(warnings.map((w) => w.issuedBy?.toString()).filter(Boolean)),
    ];

    if (issuerIds.length > 0) {
      // Use the User model from the MAIN database, not admin database
      const User = require("../../models/User");
      const issuers = await User.find({ _id: { $in: issuerIds } })
        .select("name username")
        .lean();

      const issuerMap = {};
      issuers.forEach((i) => {
        issuerMap[i._id.toString()] = {
          name: i.name,
          username: i.username,
        };
      });

      // Map issuers to warnings
      const populatedWarnings = warnings.map((w) => ({
        ...w,
        issuedBy: w.issuedBy
          ? issuerMap[w.issuedBy.toString()] || {
              name: "Unknown",
              username: "unknown",
            }
          : { name: "System", username: "system" },
      }));

      return res.status(200).json({
        success: true,
        data: { warnings: populatedWarnings },
      });
    }

    // If no issuers to populate, return warnings with default issuer
    const defaultWarnings = warnings.map((w) => ({
      ...w,
      issuedBy: { name: "System", username: "system" },
    }));

    res.status(200).json({
      success: true,
      data: { warnings: defaultWarnings },
    });
  } catch (error) {
    console.error("Get User Warnings Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch warnings",
    });
  }
};

// =============================================================================
// PUT /api/admin/users/:id/warnings/:warningId/revoke - Revoke a warning
// =============================================================================
const revokeWarning = async (req, res) => {
  try {
    const { reason } = req.body;

    const UserWarning = getAdminModel("UserWarning");
    const warning = await UserWarning.findOne({
      _id: req.params.warningId,
      user: req.params.id,
    });

    if (!warning) {
      return res
        .status(404)
        .json({ success: false, message: "Warning not found" });
    }

    if (!warning.isActive) {
      return res
        .status(400)
        .json({ success: false, message: "Warning is already revoked" });
    }

    warning.isActive = false;
    warning.revokedBy = req.user._id;
    warning.revokedAt = new Date();
    warning.revokeReason = reason || "Manual revocation";
    await warning.save();

    await createNotification(
      req.params.id,
      req.user._id,
      "system",
      "Warning Revoked",
      `A warning on your account has been revoked${reason ? `: ${reason}` : "."}`,
      warning._id,
      "UserWarning",
    );

    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "warning_revoked",
      targetType: "User",
      targetId: req.params.id,
      reason: reason || "Manual revocation",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res
      .status(200)
      .json({ success: true, message: "Warning revoked successfully" });
  } catch (error) {
    console.error("Revoke Warning Error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to revoke warning" });
  }
};

module.exports = {
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
};
