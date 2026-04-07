// Backend/middleware/validateEventImages.js

/**
 * Validate uploaded images before processing
 */
const validateEventImages = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    // Images are optional for update, but we'll let the controller handle validation
    return next();
  }

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_MIME_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ];

  for (const file of req.files) {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `File ${file.originalname} exceeds 10MB limit`,
      });
    }

    // Check mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: `File ${file.originalname} is not a supported image type`,
      });
    }
  }

  next();
};

module.exports = { validateEventImages };
