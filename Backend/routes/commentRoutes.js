const express = require("express");
const router = express.Router({ mergeParams: true });
const commentController = require("../controllers/commentController");
const { protect } = require("../middleware/authmiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

router.use(protect);

router.get("/", commentController.getPostComments);

router.post("/", preventBlockedInteractions, commentController.addComment);

router.get("/:commentId", commentController.getCommentThread);

router.post(
  "/:commentId/replies",
  preventBlockedInteractions,
  commentController.addReply,
);

router.post(
  "/:commentId/like",
  preventBlockedInteractions,
  commentController.toggleCommentLike,
);

router.put("/:commentId", commentController.updateComment);

router.delete("/:commentId", commentController.deleteComment);

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

module.exports = router;
