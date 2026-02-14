const emailService = require("./emailService");

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? process.env.PRODUCTION_URL
    : process.env.BASE_URL || "http://172.20.10.2:5001"; // Default IP for development

const sendVerificationEmail = async (user) => {
  try {
    // Generate token on user model
    const verificationToken = user.generateEmailVerificationToken();

    // Save without triggering password validation again
    await user.save({ validateBeforeSave: false });

    const verificationUrl = `${BASE_URL}/verify-email/${verificationToken}`;

    await emailService.sendVerificationEmail({
      to: user.email,
      name: user.name,
      verificationUrl,
    });

    console.log(`✅ Verification email sent to ${user.email}`);
    return true;
  } catch (error) {
    console.error("❌ Verification email service failed:", error);
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
};
