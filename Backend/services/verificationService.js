// Backend/services/verificationService.js
const emailService = require("./emailService");

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? process.env.PRODUCTION_URL
    : process.env.BASE_URL || "http://172.20.10.2:5001";

const EXPO_GO_URL = "exp://172.20.10.2:8081";

/**
 * Send verification email to user
 * Generates verification token and sends both web and deep links
 * @param {Object} user - User object with generateEmailVerificationToken method
 * @returns {Promise<boolean>} - Success status
 */
const sendVerificationEmail = async (user) => {
  try {
    const verificationToken = user.generateEmailVerificationToken();
    await user.save({ validateBeforeSave: false });

    const webUrl = `${BASE_URL}/verify-email/${verificationToken}`;
    const deepLinkUrl = `${EXPO_GO_URL}/--/verify?token=${verificationToken}`;

    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl: deepLinkUrl,
      webUrl: webUrl,
    });

    return true;
  } catch (error) {
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
};
