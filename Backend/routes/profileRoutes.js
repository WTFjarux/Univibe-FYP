// Backend/routes/profileRoutes.js
const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authmiddleware");
const { checkEmailVerified } = require("../middleware/verificationMiddleware");
const {
  uploadProfilePicture,
  uploadCoverPhoto,
} = require("../middleware/uploadMiddleware");

const profileController = require("../controllers/profileController");

// Apply authentication to all routes
router.use(protect);

// ============================================
// Routes Without Email Verification
// (Required for profile setup flow)
// ============================================
router.get(
  "/check-username/:username",
  profileController.checkUsernameAvailability,
);
router.get("/status", profileController.checkProfileStatus);

// ============================================
// Protected Routes (Require Email Verification)
// ============================================
router.post("/setup", checkEmailVerified, profileController.setupProfile);
router.post(
  "/upload-picture",
  checkEmailVerified,
  uploadProfilePicture,
  profileController.uploadProfilePicture,
);
router.post(
  "/upload-cover-photo",
  checkEmailVerified,
  uploadCoverPhoto,
  profileController.uploadCoverPhoto,
);
router.delete(
  "/picture",
  checkEmailVerified,
  profileController.deleteProfilePicture,
);
router.delete(
  "/cover-photo",
  checkEmailVerified,
  profileController.deleteCoverPhoto,
);
router.get("/me", checkEmailVerified, profileController.getProfileDetails);
router.get("/details", checkEmailVerified, profileController.getProfileDetails);
router.put("/update", checkEmailVerified, profileController.updateProfile);
router.get("/my-profile", checkEmailVerified, profileController.getMyProfile);

// ============================================
// Public Routes (No Email Verification Required)
// ============================================
router.get("/public/:userId", profileController.getPublicProfile);
router.get("/all", profileController.getAllProfiles);
router.get("/search", profileController.searchProfiles);
router.get("/username/:username", profileController.getProfileByUsername);

module.exports = router;
