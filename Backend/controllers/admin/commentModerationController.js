const Comment = require("../../models/Comment");
const Post = require("../../models/Post");
const User = require("../../models/User");
const { getAdminModel } = require("../../config/database");

// ============================================
// GET ALL COMMENTS (with filters)
// ============================================
const getComments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      status = "all", // all, reported, deleted
      sort = "newest",
    } = req.query;

    const query = {};

    switch (status) {
      case "reported":
        const Report = getAdminModel("Report");
        const reportedCommentIds = await Report.distinct("targetId", {
          targetType: "Comment",
          status: "pending",
        });
        query._id = { $in: reportedCommentIds };
        break;
      case "deleted":
        query.isDeleted = true;
        break;
      default:
        query.isDeleted = false;
    }

    if (search) {
      query.content = { $regex: search, $options: "i" };
    }

    let sortOption = {};
    switch (sort) {
      case "oldest":
        sortOption = { createdAt: 1 };
        break;
      default:
        sortOption = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [comments, total] = await Promise.all([
      Comment.find(query)
        .populate("user", "name username email")
        .populate("post", "content user")
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Comment.countDocuments(query),
    ]);

    // Get report counts
    const Report = getAdminModel("Report");
    const commentsWithReportCount = await Promise.all(
      comments.map(async (comment) => {
        const reportCount = await Report.countDocuments({
          targetType: "Comment",
          targetId: comment._id,
          status: "pending",
        });
        return { ...comment, reportCount };
      }),
    );

    const userIds = [
      ...new Set(
        commentsWithReportCount.map((c) => c.user?._id).filter(Boolean),
      ),
    ];
    if (userIds.length > 0) {
      const Profile = require("../../models/Profile");
      const profiles = await Profile.find({ user: { $in: userIds } })
        .select("user profilePicture")
        .lean();

      const profilePicMap = {};
      profiles.forEach((p) => {
        if (p.user) {
          profilePicMap[p.user.toString()] = p.profilePicture || null;
        }
      });

      commentsWithReportCount.forEach((comment) => {
        if (comment.user?._id) {
          comment.user.profilePicture =
            profilePicMap[comment.user._id.toString()] || null;
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        comments: commentsWithReportCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Get Comments Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch comments",
    });
  }
};

// ============================================
// DELETE COMMENT
// ============================================
const deleteComment = async (req, res) => {
  try {
    const { reason } = req.body;
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: "Comment not found",
      });
    }

    comment.isDeleted = true;
    comment.deletedAt = new Date();
    // ❌ REMOVED: comment.content = "[deleted by moderator]";
    await comment.save();

    // Update post comment count
    const Post = require("../../models/Post");
    const actualCount = await Comment.countDocuments({
      post: comment.post,
      isDeleted: false,
    });
    await Post.findByIdAndUpdate(comment.post, { commentCount: actualCount });

    // Log moderation action
    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "comment_deleted",
      targetType: "Comment",
      targetId: comment._id,
      reason: reason || "Moderator action",
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      message: "Comment deleted successfully",
    });
  } catch (error) {
    console.error("Delete Comment Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comment",
    });
  }
};

// ============================================
// BULK DELETE COMMENTS
// ============================================
const bulkDeleteComments = async (req, res) => {
  try {
    const { commentIds, reason } = req.body;

    if (!commentIds || !Array.isArray(commentIds) || commentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Comment IDs are required",
      });
    }

    // ❌ REMOVED content overwrite
    await Comment.updateMany(
      { _id: { $in: commentIds } },
      {
        isDeleted: true,
        deletedAt: new Date(),
      },
    );

    const ModerationLog = getAdminModel("ModerationLog");
    await ModerationLog.logAction({
      admin: req.user._id,
      action: "bulk_action",
      targetType: "Comment",
      targetId: req.user._id,
      reason: reason || "Bulk moderation",
      affectedCount: commentIds.length,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      success: true,
      message: `${commentIds.length} comments deleted successfully`,
    });
  } catch (error) {
    console.error("Bulk Delete Comments Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete comments",
    });
  }
};

module.exports = {
  getComments,
  deleteComment,
  bulkDeleteComments,
};
