const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const { protect } = require("../middleware/authmiddleware");

// All search routes require authentication
router.use(protect);

// ============================================
// SEARCH ROUTES
// ============================================

// Unified search across all types
// GET /api/search?q=query&limit=5
router.get("/", searchController.searchAll);

// User search
// GET /api/search/users?q=query&page=1&limit=20&campus=Herald&major=CS&year=Second
router.get("/users", searchController.searchUsers);

// Post search
// GET /api/search/posts?q=query&page=1&limit=10&campus=Herald&type=caption
router.get("/posts", searchController.searchPosts);

// Event search
// GET /api/search/events?q=query&page=1&limit=10&campus=Herald&category=Academic&status=upcoming
router.get("/events", searchController.searchEvents);

router.get("/communities", searchController.searchCommunities);

module.exports = router;
