// backend/routes/postRoutes.js

const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const commentRoutes = require("./commentRoutes");
const {
  protect,
  protectWithStatusCheck,
} = require("../middleware/authmiddleware");
const { uploadPostImages } = require("../middleware/uploadPostMiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

// All routes require authentication
router.use(protect);

// ============================================
// READ OPERATIONS (Auth only - no status check)
// ============================================
router.get("/deleted", postController.getDeletedPosts);
router.get("/user/:userId", postController.getProfilePosts);
router.get("/user/:userId/count", postController.getUserPostCount);
router.get("/search", postController.searchPosts);
router.get("/admin/anonymous", postController.getAnonymousPostsForModeration);
router.get("/:id", postController.getPostById);

// ============================================
// WRITE OPERATIONS (Auth + Status Check)
// ============================================
router.post(
  "/",
  protectWithStatusCheck,
  uploadPostImages,
  postController.createPost,
);
router.put(
  "/:id",
  protectWithStatusCheck,
  uploadPostImages,
  postController.updatePost,
);
router.delete("/:id", protectWithStatusCheck, postController.deletePost);
router.post("/:id/restore", protectWithStatusCheck, postController.restorePost);
router.delete(
  "/:id/permanent",
  protectWithStatusCheck,
  postController.permanentlyDeletePost,
);
router.post(
  "/:id/like",
  protectWithStatusCheck,
  preventBlockedInteractions,
  postController.toggleLike,
);

// Comments sub-routes inherit the status check from their own router
router.use("/:id/comments", commentRoutes);

module.exports = router;
