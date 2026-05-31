// backend/controllers/admin/postModerationController.js

const Post = require("../../models/Post");
const User = require("../../models/User");
const Community = require("../../models/Community");
const Notification = require("../../models/Notification");
const Profile = require("../../models/Profile");
const { getAdminModel } = require("../../config/database");

// ============================================
// GET ALL POSTS (with filters)
// ============================================
const getPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "all", // all, reported, deleted, anonymous, community
      sort = "newest",
      campus = "",
    } = req.query;

    const query = {};

    // Status filter
    switch (status) {
      case "reported":
        const Report = getAdminModel("Report");
        const reportedPostIds = await Report.distinct("targetId", {
          targetType: "Post",
          status: "pending",
        });
        query._id = { $in: reportedPostIds };
        break;
      case "deleted":
        query.isDeleted = true;
        query.deletedByAdmin = true;
        break;
      case "anonymous":
        query.isAnonymous = true;
        query.isDeleted = false;
        break;
      case "community":
        // ✅ Filter: Only community posts
        query.community = { $ne: null };
        query.isDeleted = false;
        break;
      case "regular":
        // ✅ Filter: Only non-community posts
        query.community = null;
        query.isDeleted = false;
        break;
      default:
        query.isDeleted = false;
    }

    // Campus filter
    if (campus) {
      query.campus = campus;
    }

    // Search filter
    if (search) {
      query.content = { $regex: search, $options: "i" };
    }

    // Sort
    let sortOption = {};
    switch (sort) {
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      case "most_comments":
        sortOption = { commentCount: -1 };
        break;
      case "most_reported":
        sortOption = { reportedCount: -1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [posts, total] = await Promise.all([
      Post.find(query)
        .populate("user", "name username email")
        .populate("community", "name type coverImage") // ✅ Populate community info
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Post.countDocuments(query),
    ]);

    // Get report counts for each post
    const Report = getAdminModel("Report");
    const postsWithReportCount = await Promise.all(
      posts.map(async (post) => {
        const reportCount = await Report.countDocuments({
          targetType: "Post",
          targetId: post._id,
          status: "pending",
        });
        return { ...post, reportCount };
      }),
    );

    // ✅ Fetch profile pictures for all users
    const userIds = [
      ...new Set(postsWithReportCount.map((p) => p.user?._id).filter(Boolean)),
    ];
    if (userIds.length > 0) {
      const profiles = await Profile.find({ user: { $in: userIds } })
        .select("user profilePicture")
        .lean();

      const profilePicMap = {};
      profiles.forEach((p) => {
        if (p.user) {
          profilePicMap[p.user.toString()] = p.profilePicture || null;
        }
      });

      postsWithReportCount.forEach((post) => {
        if (post.user?._id) {
          post.user.profilePicture =
            profilePicMap[post.user._id.toString()] || null;
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        posts: postsWithReportCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get Posts Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch posts",
    });
  }
};

// ============================================
// GET SINGLE POST DETAILS
// ============================================
const getPostDetails = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("user", "name username email")
      .populate("community", "name type coverImage") // ✅ Populate community
      .lean();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const Report = getAdminModel("Report");
    const reports = await Report.find({
      targetType: "Post",
      targetId: post._id,
    })
      .populate("reportedBy", "name username")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { post, reports },
    });
  } catch (error) {
    console.error("Get Post Details Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch post details",
    });
  }
};

// ============================================
// DELETE POST (soft delete)
// ============================================
const deletePost = async (req, res) => {
  try {
    const { reason } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Soft delete with admin tracking
    post.isDeleted = true;
    post.deletedAt = new Date();
    post.deletedBy = req.user._id;
    post.deletedByAdmin = true;
    post.deleteReason = reason || "Moderator action";
    await post.save({ validateModifiedOnly: true });

    // ✅ Send notification to post owner
    await Notification.create({
      recipient: post.user,
      sender: req.user._id,
      type: "post_removed",
      title: "Post Removed",
      message: reason
        ? `Your post was removed: ${reason}`
        : "Your post was removed for violating community guidelines",
      targetId: post._id,
      targetModel: "Post",
    });

    // Log moderation action
    const ModerationLog = getAdminModel("ModerationLog");
    if (ModerationLog?.logAction) {
      await ModerationLog.logAction({
        admin: req.user._id,
        action: "post_deleted",
        targetType: "Post",
        targetId: post._id,
        reason: reason || "Moderator action",
        details: { postContent: post.content?.substring(0, 100) },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    }

    res.status(200).json({
      success: true,
      message: "Post removed successfully",
    });
  } catch (error) {
    console.error("Delete Post Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete post",
    });
  }
};

// ============================================
// RESTORE POST
// ============================================
const restorePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).includeDeleted();

    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    await Post.findByIdAndUpdate(req.params.id, {
      isDeleted: false,
      deletedAt: null,
    }).includeDeleted();

    const ModerationLog = getAdminModel("ModerationLog");
    if (ModerationLog?.logAction) {
      await ModerationLog.logAction({
        admin: req.user._id,
        action: "post_restored",
        targetType: "Post",
        targetId: post._id,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    }

    res.status(200).json({
      success: true,
      message: "Post restored successfully",
    });
  } catch (error) {
    console.error("Restore Post Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to restore post",
    });
  }
};

// ============================================
// BULK DELETE POSTS
// ============================================
const bulkDeletePosts = async (req, res) => {
  try {
    const { postIds, reason } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Post IDs are required",
      });
    }

    await Post.updateMany(
      { _id: { $in: postIds } },
      { isDeleted: true, deletedAt: new Date() },
    );

    const ModerationLog = getAdminModel("ModerationLog");
    if (ModerationLog?.logAction) {
      await ModerationLog.logAction({
        admin: req.user._id,
        action: "bulk_action",
        targetType: "Post",
        targetId: req.user._id,
        reason: reason || "Bulk moderation",
        details: { postIds, count: postIds.length },
        affectedCount: postIds.length,
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      });
    }

    res.status(200).json({
      success: true,
      message: `${postIds.length} posts deleted successfully`,
    });
  } catch (error) {
    console.error("Bulk Delete Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete posts",
    });
  }
};

module.exports = {
  getPosts,
  getPostDetails,
  deletePost,
  restorePost,
  bulkDeletePosts,
};
