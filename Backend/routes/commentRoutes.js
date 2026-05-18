// backend/routes/commentRoutes.js

const express = require("express");
const router = express.Router({ mergeParams: true });
const commentController = require("../controllers/commentController");
const {
  protect,
  protectWithStatusCheck,
} = require("../middleware/authmiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

// All routes require authentication
router.use(protect);

// ============================================
// READ OPERATIONS (Auth only - no status check)
// ============================================
router.get("/", commentController.getPostComments);
router.get("/:commentId", commentController.getCommentThread);
router.get("/:commentId/reply-count", async (req, res) => {
  try {
    const Comment = require("../models/Comment");
    const count = await Comment.countDocuments({
      parentComment: req.params.commentId,
      isDeleted: false,
    });
    res.json({ success: true, replyCount: count });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
router.get("/:commentId/likes", async (req, res) => {
  try {
    const Comment = require("../models/Comment");
    const comment = await Comment.findById(req.params.commentId).populate(
      "likes",
      "name username profilePicture",
    );
    if (!comment) {
      return res
        .status(404)
        .json({ success: false, error: "Comment not found" });
    }
    res.json({
      success: true,
      likeCount: comment.likes.length,
      likes: comment.likes,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// WRITE OPERATIONS (Auth + Status Check)
// ============================================
router.post(
  "/",
  protectWithStatusCheck,
  preventBlockedInteractions,
  commentController.addComment,
);
router.post(
  "/:commentId/replies",
  protectWithStatusCheck,
  preventBlockedInteractions,
  commentController.addReply,
);
router.post(
  "/:commentId/like",
  protectWithStatusCheck,
  preventBlockedInteractions,
  commentController.toggleCommentLike,
);
router.put(
  "/:commentId",
  protectWithStatusCheck,
  commentController.updateComment,
);
router.delete(
  "/:commentId",
  protectWithStatusCheck,
  commentController.deleteComment,
);

module.exports = router;
