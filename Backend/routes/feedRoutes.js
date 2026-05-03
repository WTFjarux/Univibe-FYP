// backend/routes/feedRoutes.js
const express = require("express");
const router = express.Router();
const feedController = require("../controllers/feedController");
const { protect } = require("../middleware/authmiddleware");

// All feed routes require authentication
router.use(protect);

// GET /api/feed/campus - Campus/All feed (default tab)
router.get("/campus", feedController.getCampusFeed);

// GET /api/feed/connections - Connections feed
router.get("/connections", feedController.getConnectionsFeed);

// GET /api/feed/anonymous - Anonymous feed
router.get("/anonymous", feedController.getAnonymousFeed);

module.exports = router;
