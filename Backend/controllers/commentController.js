// backend/controllers/commentController.js

const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Notification = require("../models/Notification");
const Block = require("../models/Block");
const { getAdminModel } = require("../config/database");

// ===================== HELPER FUNCTIONS =====================

async function canUserViewPost(userId, post) {
  if (post.user.toString() === userId.toString()) {
    return true;
  }

  const isBlocked = await Block.areUsersBlocked(userId, post.user);
  if (isBlocked) return false;

  const user = await User.findById(userId).select("connections");
  const userProfile = await Profile.findOne({ user: userId }).select("campus");
  const userCampus = userProfile?.campus || "Unknown Campus";

  const connectionIds = (user.connections || []).map((id) => id.toString());

  switch (post.visibility) {
    case "campus":
      return post.campus === userCampus;

    case "connections":
      return connectionIds.includes(post.user.toString());

    default:
      return false;
  }
}

async function canUserCommentOnPost(userId, post) {
  return await canUserViewPost(userId, post);
}

const createCommentNotification = async (
  recipientId,
  senderId,
  type,
  title,
  message,
  targetId,
  targetModel,
) => {
  if (recipientId.toString() === senderId.toString()) {
    return null;
  }

  const isBlocked = await Block.areUsersBlocked(recipientId, senderId);
  if (isBlocked) return null;

  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      targetId,
      targetModel,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

function extractMentions(content) {
  const mentionRegex = /@(\w+)/g;
  const matches = content.match(mentionRegex);
  return matches ? matches.map((mention) => mention.substring(1)) : [];
}

function processCommentForAnonymous(comment, post, currentUserId) {
  const commentObj = comment.toObject ? comment.toObject() : comment;

  if (
    post.isAnonymous &&
    comment.user._id.toString() === post.user.toString()
  ) {
    commentObj.user = {
      _id: null,
      name: "Anonymous",
      username: "anonymous",
      profilePicture: null,
    };
  } else if (comment.isAnonymous) {
    commentObj.user = {
      _id: null,
      name: "Anonymous",
      username: "anonymous",
      profilePicture: null,
    };
  }

  return commentObj;
}

async function fetchReplies(commentId, userId, post, profilePictureMap) {
  const replies = await Comment.find({
    parentComment: commentId,
    isDeleted: false,
  })
    .populate("user", "name username email verified")
    .sort({ createdAt: 1 })
    .lean();

  for (let reply of replies) {
    const shouldHideUser =
      (post.isAnonymous &&
        reply.user._id.toString() === post.user.toString()) ||
      reply.isAnonymous;

    if (!shouldHideUser) {
      reply.user.profilePicture =
        profilePictureMap[reply.user._id.toString()] || null;
    }

    reply.isLiked =
      reply.likes?.some((likeId) => {
        if (!likeId) return false;
        return likeId.toString() === userId.toString();
      }) || false;

    reply.replies = await fetchReplies(
      reply._id,
      userId,
      post,
      profilePictureMap,
    );
  }

  return replies;
}

async function getAllChildCommentIds(commentId) {
  const children = await Comment.find({
    parentComment: commentId,
    isDeleted: false,
  }).select("_id");

  let ids = children.map((c) => c._id);

  for (const child of children) {
    const childIds = await getAllChildCommentIds(child._id);
    ids = [...ids, ...childIds];
  }

  return ids;
}

async function updatePostCommentCount(postId) {
  const actualCount = await Comment.countDocuments({
    post: postId,
    isDeleted: false,
  });

  await Post.findByIdAndUpdate(postId, { commentCount: actualCount });
  return actualCount;
}

// ===================== COMMENT CONTROLLERS =====================

exports.addComment = async (req, res) => {
  try {
    const { content, isAnonymous = false } = req.body;
    const postId = req.params.id;
    const userId = req.user._id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Comment content is required",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Comment must be less than 500 characters",
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    if (post.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, post.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: "You cannot comment on this post",
        });
      }
    }

    const canComment = await canUserCommentOnPost(userId, post);
    if (!canComment) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to comment on this post",
      });
    }

    const isFromAnonymousPost =
      post.isAnonymous && userId.toString() === post.user.toString();

    const newComment = new Comment({
      post: postId,
      user: userId,
      content: content.trim(),
      parentComment: null,
      depth: 1,
      isFromAnonymousPost: isFromAnonymousPost,
      isAnonymous: isAnonymous,
      likes: [],
      replies: [],
    });

    await newComment.save();
    await updatePostCommentCount(postId);

    const recentComments = await Comment.find({
      post: postId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("_id");
    post.recentComments = recentComments.map((c) => c._id);
    await post.save();

    await newComment.populate({
      path: "user",
      select: "name username email verified",
    });

    if (post.user.toString() !== userId.toString() && !post.isAnonymous) {
      const notification = await createCommentNotification(
        post.user,
        userId,
        "comment",
        "New Comment",
        content,
        postId,
        "Post",
      );

      const io = req.app.get("io");
      if (io && notification) {
        const populatedNotif = await Notification.findById(notification._id)
          .populate("sender", "name username email")
          .lean();

        if (populatedNotif) {
          const senderProfile = await Profile.findOne({ user: userId })
            .select("profilePicture fullName")
            .lean();

          if (senderProfile) {
            populatedNotif.sender = {
              ...populatedNotif.sender,
              profilePicture: senderProfile.profilePicture || null,
              fullName: senderProfile.fullName || populatedNotif.sender.name,
            };
          }

          io.to(`user_${post.user}`).emit("notification:new", {
            notification: populatedNotif,
          });

          const unreadCount = await Notification.countDocuments({
            recipient: post.user,
            read: false,
          });
          io.to(`user_${post.user}`).emit("notification:unreadCount", {
            count: unreadCount,
          });
        }
      }
    }

    const userProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    const commentResponse = newComment.toObject();
    const shouldHideUser =
      (post.isAnonymous && userId.toString() === post.user.toString()) ||
      isAnonymous;

    if (!shouldHideUser) {
      commentResponse.user.profilePicture = userProfile?.profilePicture || null;
    }

    const processedComment = processCommentForAnonymous(
      commentResponse,
      post,
      userId,
    );
    processedComment.isLiked = false;
    processedComment.likeCount = 0;

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      comment: processedComment,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add comment: " + error.message,
    });
  }
};

exports.addReply = async (req, res) => {
  try {
    const { content, isAnonymous = false } = req.body;
    const postId = req.params.id;
    const commentId = req.params.commentId;
    const userId = req.user._id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Reply content is required",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Reply must be less than 500 characters",
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    if (post.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, post.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: "You cannot reply on this post",
        });
      }
    }

    const canComment = await canUserCommentOnPost(userId, post);
    if (!canComment) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to reply on this post",
      });
    }

    const parentComment = await Comment.findOne({
      _id: commentId,
      post: postId,
      isDeleted: false,
    });

    if (!parentComment) {
      return res.status(404).json({
        success: false,
        error: "Parent comment not found",
      });
    }

    if (parentComment.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, parentComment.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: "You cannot reply to this comment",
        });
      }
    }

    if (parentComment.depth >= 5) {
      return res.status(400).json({
        success: false,
        error: "Maximum reply depth reached (5 levels)",
      });
    }

    const isFromAnonymousPost =
      post.isAnonymous && userId.toString() === post.user.toString();

    const reply = new Comment({
      post: postId,
      user: userId,
      content: content.trim(),
      parentComment: commentId,
      rootComment: parentComment.rootComment || parentComment._id,
      depth: parentComment.depth + 1,
      isFromAnonymousPost: isFromAnonymousPost,
      isAnonymous: isAnonymous,
      likes: [],
      replies: [],
    });

    await reply.save();
    await updatePostCommentCount(postId);

    if (
      parentComment.user.toString() !== userId.toString() &&
      !post.isAnonymous
    ) {
      const notification = await createCommentNotification(
        parentComment.user,
        userId,
        "comment",
        "New Reply",
        content,
        postId,
        "Post",
      );

      const io = req.app.get("io");
      if (io && notification) {
        const populatedNotif = await Notification.findById(notification._id)
          .populate("sender", "name username email")
          .lean();

        if (populatedNotif) {
          const senderProfile = await Profile.findOne({ user: userId })
            .select("profilePicture fullName")
            .lean();

          if (senderProfile) {
            populatedNotif.sender = {
              ...populatedNotif.sender,
              profilePicture: senderProfile.profilePicture || null,
              fullName: senderProfile.fullName || populatedNotif.sender.name,
            };
          }

          io.to(`user_${parentComment.user}`).emit("notification:new", {
            notification: populatedNotif,
          });

          const unreadCount = await Notification.countDocuments({
            recipient: parentComment.user,
            read: false,
          });
          io.to(`user_${parentComment.user}`).emit("notification:unreadCount", {
            count: unreadCount,
          });
        }
      }
    }

    await reply.populate({
      path: "user",
      select: "name username email verified",
    });

    const userProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    const replyResponse = reply.toObject();
    const shouldHideUser =
      (post.isAnonymous && userId.toString() === post.user.toString()) ||
      isAnonymous;

    if (!shouldHideUser) {
      replyResponse.user.profilePicture = userProfile?.profilePicture || null;
    }

    const processedReply = processCommentForAnonymous(
      replyResponse,
      post,
      userId,
    );
    processedReply.isLiked = false;
    processedReply.likeCount = 0;

    res.status(201).json({
      success: true,
      message: "Reply added successfully",
      reply: processedReply,
    });
  } catch (error) {
    console.error("Error adding reply:", error);
    res.status(500).json({
      success: false,
      error: "Failed to add reply: " + error.message,
    });
  }
};

exports.getPostComments = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    if (post.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, post.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: "You cannot view comments on this post",
        });
      }
    }

    const blockedUserIds =
      await require("../services/blockService").getBlockedUserIds(userId);

    const totalComments = await Comment.countDocuments({
      post: postId,
      isDeleted: false,
      user: { $nin: blockedUserIds },
    });

    const profiles = await Profile.find().select("user profilePicture").lean();
    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    const topLevelComments = await Comment.find({
      post: postId,
      parentComment: null,
      isDeleted: false,
      user: { $nin: blockedUserIds },
    })
      .populate("user", "name username email verified")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const totalTopLevel = await Comment.countDocuments({
      post: postId,
      parentComment: null,
      isDeleted: false,
      user: { $nin: blockedUserIds },
    });

    const commentsWithReplies = [];
    for (let comment of topLevelComments) {
      const shouldHideUser =
        (post.isAnonymous &&
          comment.user._id.toString() === post.user.toString()) ||
        comment.isAnonymous;

      if (!shouldHideUser) {
        comment.user.profilePicture =
          profilePictureMap[comment.user._id.toString()] || null;
      }

      comment.isLiked =
        comment.likes?.some(
          (likeId) => likeId.toString() === userId.toString(),
        ) || false;

      comment.replies = await fetchReplies(
        comment._id,
        userId,
        post,
        profilePictureMap,
      );

      commentsWithReplies.push(
        processCommentForAnonymous(comment, post, userId),
      );
    }

    const Report = getAdminModel("Report");

    // Collect all comment IDs (top-level + replies)
    const allCommentIds = [];
    commentsWithReplies.forEach((c) => {
      allCommentIds.push(c._id);
      if (c.replies) {
        c.replies.forEach((r) => allCommentIds.push(r._id));
      }
    });

    const userReports = await Report.find({
      reportedBy: userId,
      targetType: "Comment",
      targetId: { $in: allCommentIds },
      status: { $in: ["pending", "reviewing"] },
    }).lean();

    const reportedCommentIds = new Set(
      userReports.map((r) => r.targetId.toString()),
    );

    // Add isReported to each comment
    const addReported = (comment) => {
      comment.isReported = reportedCommentIds.has(comment._id.toString());
      if (comment.replies) {
        comment.replies.forEach(addReported);
      }
    };
    commentsWithReplies.forEach(addReported);

    await Post.findByIdAndUpdate(postId, { commentCount: totalComments });

    res.json({
      success: true,
      comments: commentsWithReplies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalTopLevel,
        pages: Math.ceil(totalTopLevel / limit),
      },
      totalComments: totalComments,
    });
  } catch (error) {
    console.error("Error fetching comments:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch comments: " + error.message,
    });
  }
};

exports.getCommentThread = async (req, res) => {
  try {
    const postId = req.params.id;
    const commentId = req.params.commentId;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    const canView = await canUserViewPost(userId, post);
    if (!canView) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to view this comment thread",
      });
    }

    const profiles = await Profile.find().select("user profilePicture").lean();
    const profilePictureMap = {};
    profiles.forEach((profile) => {
      profilePictureMap[profile.user.toString()] = profile.profilePicture;
    });

    const thread = await Comment.getThread(commentId);
    if (!thread) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    const processThread = (comment) => {
      const shouldHideUser =
        (post.isAnonymous &&
          comment.user._id.toString() === post.user.toString()) ||
        comment.isAnonymous;

      if (!shouldHideUser) {
        comment.user.profilePicture =
          profilePictureMap[comment.user._id.toString()] || null;
      }

      comment.isLiked =
        comment.likes?.some(
          (likeId) => likeId.toString() === userId.toString(),
        ) || false;

      if (comment.replies && comment.replies.length > 0) {
        comment.replies = comment.replies.map((reply) => processThread(reply));
      }

      return processCommentForAnonymous(comment, post, userId);
    };

    const processedThread = processThread(thread);

    res.json({
      success: true,
      thread: processedThread,
    });
  } catch (error) {
    console.error("Error fetching comment thread:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch comment thread: " + error.message,
    });
  }
};

exports.toggleCommentLike = async (req, res) => {
  try {
    const postId = req.params.id;
    const commentId = req.params.commentId;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    if (post.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, post.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: "You cannot interact with comments on this post",
        });
      }
    }

    const canView = await canUserViewPost(userId, post);
    if (!canView) {
      return res.status(403).json({
        success: false,
        error:
          "You don't have permission to interact with comments on this post",
      });
    }

    const comment = await Comment.findOne({
      _id: commentId,
      post: postId,
      isDeleted: false,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    if (comment.user.toString() !== userId.toString()) {
      const isBlocked = await Block.areUsersBlocked(userId, comment.user);
      if (isBlocked) {
        return res.status(403).json({
          success: false,
          error: "You cannot interact with this comment",
        });
      }
    }

    const liked = comment.toggleLike(userId);
    await comment.save();

    res.json({
      success: true,
      likes: comment.likes.length,
      likesArray: comment.likes,
      isLiked: liked,
    });
  } catch (error) {
    console.error("Error toggling comment like:", error);
    res.status(500).json({
      success: false,
      error: "Failed to toggle comment like: " + error.message,
    });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const postId = req.params.id;
    const commentId = req.params.commentId;
    const userId = req.user._id;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    const comment = await Comment.findOne({
      _id: commentId,
      post: postId,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    if (
      comment.user.toString() !== userId.toString() &&
      post.user.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to delete this comment",
      });
    }

    const childIds = await getAllChildCommentIds(commentId);
    const allCommentIds = [commentId, ...childIds];

    await Comment.updateMany(
      { _id: { $in: allCommentIds } },
      {
        isDeleted: true,
        deletedAt: new Date(),
        content: "[deleted]",
      },
    );

    const updatedCount = await updatePostCommentCount(postId);

    res.json({
      success: true,
      message: `Comment and ${childIds.length} repl${childIds.length === 1 ? "y" : "ies"} deleted successfully`,
      deletedCount: allCommentIds.length,
      newCommentCount: updatedCount,
    });
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to delete comment: " + error.message,
    });
  }
};

exports.updateComment = async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.id;
    const commentId = req.params.commentId;
    const userId = req.user._id;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Comment content is required",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        success: false,
        error: "Comment must be less than 500 characters",
      });
    }

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        error: "Post not found",
      });
    }

    const comment = await Comment.findOne({
      _id: commentId,
      post: postId,
      isDeleted: false,
    });

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: "Comment not found",
      });
    }

    if (comment.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this comment",
      });
    }

    comment.content = content.trim();
    comment.isEdited = true;
    comment.editedAt = new Date();
    await comment.save();

    await comment.populate({
      path: "user",
      select: "name username email verified",
    });

    const userProfile = await Profile.findOne({ user: userId })
      .select("profilePicture")
      .lean();

    const commentResponse = comment.toObject();
    commentResponse.user.profilePicture = userProfile?.profilePicture || null;

    res.json({
      success: true,
      message: "Comment updated successfully",
      comment: commentResponse,
    });
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update comment: " + error.message,
    });
  }
};

exports.debugCommentCounts = async (req, res) => {
  try {
    const postId = req.params.id;

    const totalComments = await Comment.countDocuments({
      post: postId,
      isDeleted: false,
    });

    const post = await Post.findById(postId);

    res.json({
      success: true,
      postId,
      commentCountInPost: post?.commentCount || 0,
      actualCommentCount: totalComments,
      difference: totalComments - (post?.commentCount || 0),
      postExists: !!post,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
