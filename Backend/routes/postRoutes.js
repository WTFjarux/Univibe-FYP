// backend/routes/postRoutes.js
const express = require("express");
const router = express.Router();
const postController = require("../controllers/postController");
const commentRoutes = require("./commentRoutes");
const { protect } = require("../middleware/authmiddleware");
const { uploadPostImages } = require("../middleware/uploadPostMiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

router.use(protect);

router.post("/", uploadPostImages, postController.createPost);

router.get("/deleted", postController.getDeletedPosts);
router.get("/user/:userId", postController.getProfilePosts);
router.get("/user/:userId/count", postController.getUserPostCount);
router.get("/search", postController.searchPosts);
router.get("/admin/anonymous", postController.getAnonymousPostsForModeration);

router.get("/:id", postController.getPostById);
router.put("/:id", uploadPostImages, postController.updatePost);
router.delete("/:id", postController.deletePost);
router.post("/:id/restore", postController.restorePost);
router.delete("/:id/permanent", postController.permanentlyDeletePost);
router.post("/:id/like", preventBlockedInteractions, postController.toggleLike);

router.use("/:id/comments", commentRoutes);

module.exports = router;
