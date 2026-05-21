const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const { uploadStoryMedia } = require("../middleware/uploadMiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

const ctrl = require("../controllers/storyController");

// All story routes require authentication
router.use(protect);

// Story CRUD
router.post("/", uploadStoryMedia, ctrl.createStory);
router.get("/", ctrl.getStories);
router.delete("/:storyId", ctrl.deleteStory);

// Story interactions (protected by block middleware)
router.post("/:storyId/view", preventBlockedInteractions, ctrl.viewStory);
router.post("/:storyId/reply", preventBlockedInteractions, ctrl.replyToStory);
router.get("/:storyId/viewers", ctrl.getStoryViewers);

// Story maintenance (admin/cron)
router.get("/expired/cleanup", ctrl.cleanupExpiredStories);

module.exports = router;
