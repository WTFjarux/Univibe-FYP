const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const { uploadStoryMedia } = require("../middleware/uploadMiddleware");
const { preventBlockedInteractions } = require("../middleware/blockMiddleware");

const ctrl = require("../controllers/storyController");

router.use(protect);

router.post("/", uploadStoryMedia, ctrl.createStory);
router.get("/", ctrl.getStories);
router.get("/:storyId/viewers", ctrl.getStoryViewers);
router.post("/:storyId/view", preventBlockedInteractions, ctrl.viewStory);
router.post("/:storyId/reply", preventBlockedInteractions, ctrl.replyToStory);
router.delete("/:storyId", ctrl.deleteStory);

module.exports = router;
