// Backend/services/profileService.js
const Profile = require("../models/Profile");

/**
 * Create initial profile for a newly registered user
 * Generates a unique username and sets default profile values
 * @param {Object} user - The newly created User object
 * @returns {Promise<Object>} - Success status and profile data
 */
const createInitialProfile = async (user) => {
  try {
    if (!user?._id || !user?.email || !user?.name) {
      return { success: false, error: "Invalid user data" };
    }

    const username = generateUniqueUsername(user.email);

    const profile = await Profile.create({
      user: user._id,
      username,
      fullName: user.name,
      major: "Undecided",
      year: "UPC",
      graduationYear: String(new Date().getFullYear() + 4),
      universityEmail: user.email,
      profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=user-${user._id}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      success: true,
      profile,
      username,
    };
  } catch (error) {
    // Handle duplicate key error by retrying with a new username
    if (error.code === 11000) {
      return await createInitialProfile(user);
    }

    return {
      success: false,
      error: error.message,
      code: error.code || "PROFILE_CREATION_ERROR",
    };
  }
};

/**
 * Generate a unique username based on email
 * @param {string} email - User's email address
 * @returns {string} - Generated username
 */
const generateUniqueUsername = (email) => {
  const emailUsername = email.split("@")[0].toLowerCase();
  const cleanUsername = emailUsername.replace(/[^a-z0-9]/g, "");
  const randomSuffix = Math.floor(Math.random() * 1000);
  const baseUsername = cleanUsername || "user";

  return `${baseUsername}${randomSuffix}`;
};

module.exports = {
  createInitialProfile,
};
