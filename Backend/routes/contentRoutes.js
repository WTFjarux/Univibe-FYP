// backend/routes/contentRoutes.js
const express = require("express");
const router = express.Router();
const contentController = require("../controllers/contentController");
const { protect } = require("../middleware/authmiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

router.use(protect);

// Saved posts
router.post(
  "/save/:postId",
  preventBlockedInteractions,
  contentController.toggleSavePost,
);
router.get("/saved", contentController.getSavedPosts);

// Hidden posts
router.post(
  "/hide/:postId",
  preventBlockedInteractions,
  contentController.hidePost,
);
router.post(
  "/unhide/:postId",
  preventBlockedInteractions,
  contentController.unhidePost,
);
router.get("/hidden", contentController.getHiddenPosts);

// Muted users
router.post(
  "/mute/:userId",
  preventBlockedInteractions,
  contentController.toggleMuteUser,
);
router.get("/muted", contentController.getMutedUsers);

// Blocked users
router.post("/block/:userId", contentController.toggleBlockUser);
router.get("/blocked", contentController.getBlockedUsers);

module.exports = router;
