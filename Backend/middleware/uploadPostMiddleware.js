// Backend/middleware/uploadPostMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create posts upload directory if it doesn't exist
const postsDir = "uploads/posts";

if (!fs.existsSync(postsDir)) {
  fs.mkdirSync(postsDir, { recursive: true });
  console.log(`✅ Created post upload directory: ${postsDir}`);
}

// Configure storage for post uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create user-specific directory for better organization
    const userId = req.user?.id || "anonymous";
    const userPostsDir = path.join(postsDir, userId);

    if (!fs.existsSync(userPostsDir)) {
      fs.mkdirSync(userPostsDir, { recursive: true });
    }

    cb(null, userPostsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || "unknown";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    // Get extension from original name
    let ext = path.extname(file.originalname).toLowerCase();

    // Handle iPhone HEIC photos - convert to jpg
    if (ext === ".heic" || ext === ".heif") {
      ext = ".jpg";
      console.log(`📱 iPhone HEIC/HEIF post file detected, converting to JPG`);
    }

    // If no extension, add based on mimetype
    if (!ext) {
      if (file.mimetype === "image/jpeg") {
        ext = ".jpg";
      } else if (file.mimetype === "image/png") {
        ext = ".png";
      } else if (file.mimetype === "image/gif") {
        ext = ".gif";
      } else if (file.mimetype === "image/webp") {
        ext = ".webp";
      } else {
        ext = ".jpg";
      }
    }

    // Create filename with post prefix
    const filename = `post-${uniqueSuffix}${ext}`;

    console.log(`📁 Post file upload details:`, {
      userId,
      fieldname: file.fieldname,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: formatBytes(file.size),
      finalFilename: filename,
    });

    cb(null, filename);
  },
});

// File filter for posts - allows multiple image types
const fileFilter = (req, file, cb) => {
  console.log("🔍 Post file filter checking:", {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: formatBytes(file.size),
  });

  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase();

  // ALLOW iPhone HEIC/HEIF files
  if (ext === ".heic" || ext === ".heif") {
    console.log(`✅ iPhone post photo accepted: ${file.originalname}`);
    return cb(null, true);
  }

  // Check if it's an image file
  const isImage = file.mimetype.startsWith("image/");

  // Allowed image types
  const allowedMimeTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ];

  if (isImage && allowedMimeTypes.includes(file.mimetype)) {
    console.log(
      `✅ Post image accepted: ${file.originalname} (${file.mimetype})`,
    );
    cb(null, true);
  } else {
    console.log(
      `❌ Post file rejected - not a valid image: ${file.originalname} (${file.mimetype})`,
    );
    cb(
      new Error(
        "Only image files (JPEG, PNG, GIF, WEBP, HEIC) are allowed for posts",
      ),
    );
  }
};

// Create multer instance for posts
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 75 * 1024 * 1024, // 75MB limit per file
    files: 4, // Max 4 images per post (as per your frontend design)
  },
});

// Middleware for single post image (for update operations)
const uploadPostImage = (req, res, next) => {
  const uploadSingle = upload.single("image");

  uploadSingle(req, res, function (err) {
    handleUploadError(err, req, res, next, "post image");
  });
};

// Middleware for multiple post images (for create post)
const uploadPostImages = (req, res, next) => {
  const uploadMultiple = upload.array("images", 4); // Max 4 images

  uploadMultiple(req, res, function (err) {
    handleUploadError(err, req, res, next, "post images");
  });
};

// Middleware for multiple post images with specific field name (alternative)
const uploadMultipleImages = upload.fields([{ name: "images", maxCount: 4 }]);

const uploadPostImagesFields = (req, res, next) => {
  uploadMultipleImages(req, res, function (err) {
    handleUploadError(err, req, res, next, "post images");
  });
};

// Error handling function for posts
function handleUploadError(err, req, res, next, uploadType = "post images") {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    let errorMessage = `Upload error: ${err.message}`;

    if (err.code === "LIMIT_FILE_SIZE") {
      errorMessage = `Post image size is too large. Maximum size is 75MB per image.`;
    } else if (err.code === "LIMIT_FILE_COUNT") {
      errorMessage =
        "Too many post images uploaded. Maximum is 4 images per post.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      errorMessage =
        'Unexpected file field. Please use "images" as the field name for post images.';
    } else if (err.code === "LIMIT_PART_COUNT") {
      errorMessage = "Too many parts in the request.";
    } else if (err.code === "LIMIT_FIELD_KEY") {
      errorMessage = "Field name is too long.";
    } else if (err.code === "LIMIT_FIELD_VALUE") {
      errorMessage = "Field value is too long.";
    } else if (err.code === "LIMIT_FIELD_COUNT") {
      errorMessage = "Too many fields in the request.";
    }

    console.error(`❌ Post ${uploadType} Multer error:`, err.code, err.message);
    return res.status(400).json({
      success: false,
      message: errorMessage,
    });
  } else if (err) {
    // Other errors (file filter, etc.)
    console.error(`❌ Post ${uploadType} upload error:`, err.message);
    return res.status(400).json({
      success: false,
      message: err.message || `Failed to upload ${uploadType}`,
    });
  }

  // Log successful file info for posts
  if (req.files) {
    if (Array.isArray(req.files)) {
      // Single array of files
      console.log(`✅ ${req.files.length} post images uploaded successfully:`);
      req.files.forEach((file, index) => {
        console.log(`  Image ${index + 1}:`, {
          filename: file.filename,
          originalname: file.originalname,
          size: formatBytes(file.size),
          mimetype: file.mimetype,
          path: file.path,
          destination: file.destination,
        });
      });
    } else {
      // Object with fields (for upload.fields())
      Object.keys(req.files).forEach((fieldname) => {
        console.log(
          `✅ ${req.files[fieldname].length} ${fieldname} uploaded for post:`,
        );
        req.files[fieldname].forEach((file, index) => {
          console.log(`  ${fieldname} ${index + 1}:`, {
            filename: file.filename,
            originalname: file.originalname,
            size: formatBytes(file.size),
            mimetype: file.mimetype,
            path: file.path,
            destination: file.destination,
          });
        });
      });
    }
  } else if (req.file) {
    // Single file
    console.log("✅ Post image uploaded successfully:", {
      fieldname: req.file.fieldname,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: formatBytes(req.file.size),
      mimetype: req.file.mimetype,
      path: req.file.path,
      destination: req.file.destination,
    });
  }

  // No errors, proceed
  next();
}

// Helper function to format file size (same as your existing)
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// ================ FIXED: Store RELATIVE paths in database ================

/**
 * Get RELATIVE path for post images (to store in database)
 * @param {Object} req - Express request object
 * @param {string} filename - Uploaded filename
 * @returns {string} Relative path (e.g., /uploads/posts/userId/filename.jpg)
 */
function getPostImageRelativePath(req, filename) {
  if (!filename) return null;

  const userId = req.user?.id || "anonymous";

  // Return ONLY the relative path - NOT absolute URL
  return `/uploads/posts/${userId}/${filename}`;
}

/**
 * Convert relative path to absolute URL (for API responses only)
 * @param {Object} req - Express request object
 * @param {string} relativePath - Relative path from database
 * @returns {string} Absolute URL
 */
function getAbsoluteImageUrl(req, relativePath) {
  if (!relativePath) return null;

  // If it's already an absolute URL, return as is
  if (
    relativePath.startsWith("http://") ||
    relativePath.startsWith("https://")
  ) {
    return relativePath;
  }

  // Convert relative path to absolute URL using current request
  const serverUrl = req.protocol + "://" + req.get("host");
  return relativePath.startsWith("/")
    ? serverUrl + relativePath
    : serverUrl + "/" + relativePath;
}

// Function to delete post images (cleanup when post is deleted)
function deletePostImages(userId, filenames) {
  if (!Array.isArray(filenames)) {
    filenames = [filenames];
  }

  let deletedCount = 0;
  let errors = [];

  filenames.forEach((filename) => {
    if (!filename) return;

    const filePath = path.join(postsDir, userId, filename);

    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted post image: ${filePath}`);
        deletedCount++;
      } else {
        console.log(`⚠️ Post image not found: ${filePath}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting post image ${filename}:`, error.message);
      errors.push({ filename, error: error.message });
    }
  });

  return { deletedCount, errors };
}

// Function to delete all images for a user's post directory
function cleanupUserPostDirectory(userId) {
  const userDir = path.join(postsDir, userId);

  if (fs.existsSync(userDir)) {
    try {
      // Read all files in the directory
      const files = fs.readdirSync(userDir);

      // Delete each file
      files.forEach((file) => {
        const filePath = path.join(userDir, file);
        fs.unlinkSync(filePath);
        console.log(`🗑️ Deleted post image: ${filePath}`);
      });

      // Remove the directory
      fs.rmdirSync(userDir);
      console.log(`🗑️ Cleaned up post directory for user ${userId}`);

      return { success: true, deletedCount: files.length };
    } catch (error) {
      console.error(
        `❌ Error cleaning up user post directory ${userDir}:`,
        error.message,
      );
      return { success: false, error: error.message };
    }
  }

  return {
    success: true,
    deletedCount: 0,
    message: "Directory does not exist",
  };
}

module.exports = {
  uploadPostImage,
  uploadPostImages,
  uploadPostImagesFields,
  getPostImageRelativePath, // Changed from getPostImageUrl
  getAbsoluteImageUrl, // New function for converting to absolute URLs
  deletePostImages,
  cleanupUserPostDirectory,
  // Export raw multer instance if needed
  multerUpload: upload,
};
