const express = require("express");
const router = express.Router({ mergeParams: true }); // mergeParams to access postId from parent router
const commentController = require("../controllers/commentController");
const { protect } = require("../middleware/authmiddleware");

// All comment routes require authentication
router.use(protect);

// Get all comments for a post
router.get("/", commentController.getPostComments);

// Add a comment to a post
// Body: { content: "string", isAnonymous: boolean (optional) }
router.post("/", commentController.addComment);

// Get a specific comment thread
router.get("/:commentId", commentController.getCommentThread);

// Add a reply to a comment
// Body: { content: "string", isAnonymous: boolean (optional) }
router.post("/:commentId/replies", commentController.addReply);

// Like/unlike a comment
router.post("/:commentId/like", commentController.toggleCommentLike);

// Update a comment
// Body: { content: "string" }
router.put("/:commentId", commentController.updateComment);

// Delete a comment
router.delete("/:commentId", commentController.deleteComment);

// Optional: Get reply count for a comment
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

// Optional: Get likes for a comment
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

module.exports = router;
