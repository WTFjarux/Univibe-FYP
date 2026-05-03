// backend/routes/postRoutes.js
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const commentRoutes = require("./commentRoutes");
const { protect } = require("../middleware/authmiddleware");
const { uploadPostImages } = require("../middleware/uploadPostMiddleware");

// Apply auth middleware to all routes
router.use(protect);

// ===================== POST CRUD =====================

// Create post
router.post("/", uploadPostImages, postController.createPost);

// Get single post by ID
router.get("/:id", postController.getPostById);

// Update post
router.put("/:id", uploadPostImages, postController.updatePost);

// Delete post (soft delete)
router.delete("/:id", postController.deletePost);

// Restore soft-deleted post
router.post("/:id/restore", postController.restorePost);

// Permanent delete
router.delete("/:id/permanent", postController.permanentlyDeletePost);

// ===================== INTERACTIONS =====================

// Like/Unlike post
router.post("/:id/like", postController.toggleLike);

// Nested comment routes
router.use("/:id/comments", commentRoutes);

// ===================== USER & SEARCH =====================

// Get posts for a specific user's profile
router.get("/user/:userId", postController.getProfilePosts);

// Get post count for a user
router.get("/user/:userId/count", postController.getUserPostCount);

// Search posts
router.get("/search", postController.searchPosts);

// ===================== ADMIN =====================

// Get anonymous posts for moderation
router.get("/admin/anonymous", postController.getAnonymousPostsForModeration);

module.exports = router;
