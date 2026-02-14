const Profile = require('../models/Profile');

/**
 * Create initial profile for a newly registered user
 * @param {Object} user - The newly created User object
 * @returns {Promise<Object>} - Success status and profile data
 */
const createInitialProfile = async (user) => {
  try {
    if (!user || !user._id || !user.email || !user.name) {
      console.error('❌ Invalid user object provided to profileService');
      return { success: false, error: 'Invalid user data' };
    }

    // Generate unique username from email
    const emailUsername = user.email.split('@')[0].toLowerCase();
    const cleanUsername = emailUsername.replace(/[^a-z0-9]/g, '');
    
    // Generate unique suffix and create final username
    const randomSuffix = Math.floor(Math.random() * 1000);
    const baseUsername = cleanUsername || 'user';
    const username = `${baseUsername}${randomSuffix}`;

    // Create profile with default values
    const profile = await Profile.create({
      user: user._id,
      username: username,
      fullName: user.name,
      major: 'Undecided',
      year: 'UPC',
      graduationYear: String(new Date().getFullYear() + 4),
      universityEmail: user.email,
      profilePicture: `https://api.dicebear.com/7.x/avataaars/svg?seed=user-${user._id}`,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    console.log(`✅ Profile created with username: ${username} for user ${user._id}`);
    
    return { 
      success: true, 
      profile: profile,
      username: username 
    };

  } catch (error) {
    console.error('❌ Profile creation failed:', error.message);
    
    // Handle specific error cases
    if (error.code === 11000) {
      // Duplicate key error - try again with different suffix
      console.warn('Duplicate username detected, retrying with different suffix');
      return await createInitialProfile(user); // Retry recursively
    }
    
    return { 
      success: false, 
      error: error.message,
      code: error.code || 'PROFILE_CREATION_ERROR'
    };
  }
};

module.exports = {
  createInitialProfile
};