const express = require('express');
const router = express.Router();

// Import middlewares
const { protect } = require('../middleware/authmiddleware');
const { checkEmailVerified } = require('../middleware/verificationMiddleware');
const { uploadProfilePicture, uploadCoverPhoto, uploadWithErrorHandling } = require('../middleware/uploadMiddleware');

// Import controller functions
const profileController = require('../controllers/profileController');

// Apply protect middleware to ALL routes
router.use(protect);

// ✅ Username availability check (should NOT require email verification)
// This is needed for signup/profile setup flow
router.get('/check-username/:username', profileController.checkUsernameAvailability);

// ✅ Profile status check (doesn't require email verification)
router.get('/status', profileController.checkProfileStatus);

// 🔐 Routes that require EMAIL VERIFICATION (Profile Management)
router.post('/setup', checkEmailVerified, profileController.setupProfile);
router.post('/upload-picture', checkEmailVerified, uploadProfilePicture, profileController.uploadProfilePicture);
router.post('/upload-cover-photo', checkEmailVerified, uploadCoverPhoto, profileController.uploadCoverPhoto); // NEW ROUTE
router.delete('/picture', checkEmailVerified, profileController.deleteProfilePicture);
router.delete('/cover-photo', checkEmailVerified, profileController.deleteCoverPhoto); // NEW ROUTE
router.get('/me', checkEmailVerified, profileController.getProfileDetails);
router.get('/details', checkEmailVerified, profileController.getProfileDetails);
router.put('/update', checkEmailVerified, profileController.updateProfile);
router.get('/my-profile', checkEmailVerified, profileController.getMyProfile);

// 🌐 Public routes (NO email verification required - anyone can view)
router.get('/public/:userId', profileController.getPublicProfile);
router.get('/all', profileController.getAllProfiles);
router.get('/search', profileController.searchProfiles);
router.get('/username/:username', profileController.getProfileByUsername); // For public profile viewing

module.exports = router;