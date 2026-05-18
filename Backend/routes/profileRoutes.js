// backend/routes/profileRoutes.js

const express = require("express");
const router = express.Router();

const {
  protect,
  protectWithStatusCheck,
} = require("../middleware/authmiddleware");
const { checkEmailVerified } = require("../middleware/verificationMiddleware");
const {
  uploadProfilePicture,
  uploadCoverPhoto,
} = require("../middleware/uploadMiddleware");
const { checkBlockStatus } = require("../middleware/blockMiddleware");

const profileController = require("../controllers/profileController");
const connectionRoutes = require("./connectionRoutes");

router.use(protect);

// Connection sub-routes
router.use("/connections", connectionRoutes);

// ============================================
// READ OPERATIONS (Auth only - no status check)
// ============================================
router.get(
  "/check-username/:username",
  profileController.checkUsernameAvailability,
);
router.get("/status", profileController.checkProfileStatus);
router.get("/me", checkEmailVerified, profileController.getProfileDetails);
router.get("/details", checkEmailVerified, profileController.getProfileDetails);
router.get("/my-profile", checkEmailVerified, profileController.getMyProfile);
router.get(
  "/public/:userId",
  checkBlockStatus,
  profileController.getPublicProfile,
);
router.get("/all", profileController.getAllProfiles);
router.get("/search", profileController.searchProfiles);
router.get("/username/:username", profileController.getProfileByUsername);
router.get("/search-connections", profileController.searchConnections);

// ============================================
// WRITE OPERATIONS (Auth + Status Check)
// ============================================
router.post(
  "/setup",
  protectWithStatusCheck,
  checkEmailVerified,
  profileController.setupProfile,
);
router.post(
  "/upload-picture",
  protectWithStatusCheck,
  checkEmailVerified,
  uploadProfilePicture,
  profileController.uploadProfilePicture,
);
router.post(
  "/upload-cover-photo",
  protectWithStatusCheck,
  checkEmailVerified,
  uploadCoverPhoto,
  profileController.uploadCoverPhoto,
);
router.delete(
  "/picture",
  protectWithStatusCheck,
  checkEmailVerified,
  profileController.deleteProfilePicture,
);
router.delete(
  "/cover-photo",
  protectWithStatusCheck,
  checkEmailVerified,
  profileController.deleteCoverPhoto,
);
router.put(
  "/update",
  protectWithStatusCheck,
  checkEmailVerified,
  profileController.updateProfile,
);
router.post(
  "/report/:userId",
  protectWithStatusCheck,
  checkEmailVerified,
  profileController.reportUser,
);

module.exports = router;
