const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authmiddleware");
const { uploadStoryMedia } = require("../middleware/uploadMiddleware");

const ctrl = require("../controllers/storyController");

// ============================================
// Authentication - all routes require auth
// ============================================
router.use(protect);

// ============================================
// Story CRUD
// ============================================

/**
 * POST /stories
 * Upload a new story
 * uploadStoryMedia is already a middleware that handles single('media')
 */
router.post("/", uploadStoryMedia, ctrl.createStory);

/**
 * GET /stories
 * Fetch all stories from connections + user's own
 */
router.get("/", ctrl.getStories);

/**
 * GET /stories/:storyId/viewers
 * Get list of viewers for a story (only owner)
 */
router.get("/:storyId/viewers", ctrl.getStoryViewers);

/**
 * POST /stories/:storyId/view
 * Mark story as viewed
 */
router.post("/:storyId/view", ctrl.viewStory);

/**
 * POST /stories/:storyId/reply
 * Send a reply to a story
 */
router.post("/:storyId/reply", ctrl.replyToStory);

/**
 * DELETE /stories/:storyId
 * Delete a story (only owner)
 */
router.delete("/:storyId", ctrl.deleteStory);

module.exports = router;
