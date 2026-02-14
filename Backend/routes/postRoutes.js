// routes/postRoutes.js
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
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
router.post("/:id/comments", postController.addComment);

module.exports = router;
