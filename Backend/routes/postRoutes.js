const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const commentRoutes = require("./commentRoutes"); // Import comment routes
const { protect } = require("../middleware/authmiddleware");
const { uploadPostImages } = require("../middleware/uploadPostMiddleware");

// Apply auth middleware to all routes
router.use(protect);

// Post routes
router.post("/", uploadPostImages, postController.createPost);
router.get("/", postController.getPosts);
router.get("/search", postController.searchPosts);
router.get("/:id", postController.getPostById);
router.put("/:id", uploadPostImages, postController.updatePost);
router.delete("/:id", postController.deletePost);
router.post("/:id/like", postController.toggleLike);

// Nested comment routes - this will handle all /:id/comments/* routes
router.use("/:id/comments", commentRoutes);

module.exports = router;
