const express = require("express");
const router = express.Router();
const {
  getComments,
  deleteComment,

  bulkDeleteComments,
} = require("../../controllers/admin/commentModerationController");
const { adminProtect } = require("../../middleware/adminAuth");

router.use(adminProtect);

router.get("/", getComments);
router.delete("/:id", deleteComment);

router.post("/bulk-delete", bulkDeleteComments);

module.exports = router;
