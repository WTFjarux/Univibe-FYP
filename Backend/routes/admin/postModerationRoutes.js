const express = require("express");
const router = express.Router();
const {
  getPosts,
  getPostDetails,
  deletePost,
  restorePost,
  bulkDeletePosts,
} = require("../../controllers/admin/postModerationController");
const { adminProtect } = require("../../middleware/adminAuth");

router.use(adminProtect);

router.get("/", getPosts);
router.get("/:id", getPostDetails);
router.delete("/:id", deletePost);
router.put("/:id/restore", restorePost);
router.post("/bulk-delete", bulkDeletePosts);

module.exports = router;
