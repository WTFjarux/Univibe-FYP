// backend/routes/feedRoutes.js
const express = require("express");
const router = express.Router();
const feedController = require("../controllers/feedController");
const { protect } = require("../middleware/authmiddleware");
const { filterBlockedUsers } = require("../middleware/blockMiddleware");

router.use(protect);
router.use(filterBlockedUsers);

router.get("/campus", feedController.getCampusFeed);
router.get("/connections", feedController.getConnectionsFeed);
router.get("/anonymous", feedController.getAnonymousFeed);

module.exports = router;
