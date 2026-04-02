// Backend/routes/postRoutes.js
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const commentRoutes = require("./commentRoutes");
const { protect } = require("../middleware/authmiddleware");
const { uploadPostImages } = require("../middleware/uploadPostMiddleware");

// Apply auth middleware to all routes
router.use(protect);

// Post routes
router.post("/", uploadPostImages, postController.createPost);
router.get("/", postController.getPosts);
router.get("/search", postController.searchPosts);
router.get("/user/:userId/count", postController.getUserPostCount);
router.get("/profile/:userId", postController.getProfilePosts);
router.get("/:id", postController.getPostById);
router.put("/:id", uploadPostImages, postController.updatePost);
router.delete("/:id", postController.deletePost);
router.post("/:id/like", postController.toggleLike);

// Admin routes
router.get("/admin/anonymous", postController.getAnonymousPostsForModeration);

// Nested comment routes
router.use("/:id/comments", commentRoutes);

module.exports = router;
