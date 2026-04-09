const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// Create uploads directories if they don't exist
const profilePicsDir = "uploads/profile-pictures";
const coverPhotosDir = "uploads/cover-photos";
const eventImagesDir = "uploads/events"; // New directory for event images

[profilePicsDir, coverPhotosDir, eventImagesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created upload directory: ${dir}`);
  }
});

// Configure storage for different upload types
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine destination based on field name
    if (file.fieldname === "profilePicture") {
      cb(null, profilePicsDir);
    } else if (file.fieldname === "coverPhoto") {
      cb(null, coverPhotosDir);
    } else if (file.fieldname === "images" || file.fieldname === "eventImage") {
      // Handle event images (single or multiple)
      cb(null, eventImagesDir);
    } else {
      cb(new Error("Invalid field name"), null);
    }
  },
  filename: (req, file, cb) => {
    // Get user ID from request (set by auth middleware)
    const userId = req.user?.id || req.user?._id || "unknown";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);

    // Get extension from original name or default to .jpg
    let ext = path.extname(file.originalname).toLowerCase();

    // Handle iPhone HEIC photos - convert to jpg
    if (ext === ".heic" || ext === ".heif") {
      ext = ".jpg";
      console.log(`📱 iPhone HEIC/HEIF file detected, converting to JPG`);
    }

    // If no extension, add .jpg
    if (!ext) {
      ext = ".jpg";
    }

    // Create filename with field type prefix
    let prefix = file.fieldname;
    if (file.fieldname === "images") {
      prefix = "event";
    }

    const filename = `${prefix}-${userId}-${uniqueSuffix}${ext}`;

    console.log(`📁 File upload details:`, {
      fieldname: file.fieldname,
      userId,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: formatBytes(file.size),
      finalFilename: filename,
    });

    cb(null, filename);
  },
});

// File filter - MORE LENIENT for iPhone photos
const fileFilter = (req, file, cb) => {
  // Log file info for debugging
  console.log("🔍 File filter checking:", {
    fieldname: file.fieldname,
    originalname: file.originalname,
    mimetype: file.mimetype,
    size: formatBytes(file.size),
  });

  // Get file extension
  const ext = path.extname(file.originalname).toLowerCase();

  // ALLOW iPhone HEIC/HEIF files
  if (ext === ".heic" || ext === ".heif") {
    console.log(
      `✅ iPhone photo accepted: ${file.originalname} (${file.mimetype}) - Size: ${formatBytes(file.size)}`,
    );
    return cb(null, true);
  }

  // Check if it's an image file
  const isImage = file.mimetype.startsWith("image/");

  if (isImage) {
    console.log(
      `✅ Image accepted: ${file.originalname} (${file.mimetype}) - Size: ${formatBytes(file.size)}`,
    );
    cb(null, true);
  } else {
    console.log(
      `❌ File rejected - not an image: ${file.originalname} (${file.mimetype})`,
    );
    cb(new Error("Only image files are allowed"));
  }
};

// Create multer instance with 75MB file size limit
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 75 * 1024 * 1024, // 75MB limit
    files: 10, // Increased for multiple event images (max 5 + 2 profile pics)
  },
});

// Middleware for profile picture upload only
const uploadProfilePicture = (req, res, next) => {
  const uploadSingle = upload.single("profilePicture");

  uploadSingle(req, res, function (err) {
    handleUploadError(err, req, res, next);
  });
};

// Middleware for cover photo upload only
const uploadCoverPhoto = (req, res, next) => {
  const uploadSingle = upload.single("coverPhoto");

  uploadSingle(req, res, function (err) {
    handleUploadError(err, req, res, next);
  });
};

// ============================================
// NEW: Middleware for event images
// ============================================

// Upload multiple event images (up to 5)
const uploadEventImages = (req, res, next) => {
  const uploadMultiple = upload.array("images", 5); // Max 5 images

  uploadMultiple(req, res, function (err) {
    handleUploadError(err, req, res, next);
  });
};

// Upload single event image
const uploadEventImage = (req, res, next) => {
  const uploadSingle = upload.single("eventImage");

  uploadSingle(req, res, function (err) {
    handleUploadError(err, req, res, next);
  });
};

// Process and optimize event images with Sharp
const processEventImages = async (files) => {
  if (!files || files.length === 0) return files;

  const processedFiles = [];

  for (const file of files) {
    try {
      // Skip if file is not an image or already processed
      if (!file.path || !fs.existsSync(file.path)) {
        processedFiles.push(file);
        continue;
      }

      // Process image with Sharp
      let sharpInstance = sharp(file.path);

      // Get metadata
      const metadata = await sharpInstance.metadata();

      // Resize if too large (max 1920px width)
      if (metadata.width && metadata.width > 1920) {
        sharpInstance = sharpInstance.resize(1920, null, {
          withoutEnlargement: true,
          fit: "inside",
        });
      }

      // Compress based on format
      if (file.mimetype === "image/jpeg" || file.mimetype === "image/jpg") {
        sharpInstance = sharpInstance.jpeg({ quality: 80, progressive: true });
      } else if (file.mimetype === "image/png") {
        sharpInstance = sharpInstance.png({ quality: 80, compressionLevel: 8 });
      } else if (file.mimetype === "image/webp") {
        sharpInstance = sharpInstance.webp({ quality: 80 });
      }

      // Save optimized image (overwrite original)
      await sharpInstance.toFile(file.path + ".tmp");
      fs.unlinkSync(file.path);
      fs.renameSync(file.path + ".tmp", file.path);

      // Update file size
      const stats = fs.statSync(file.path);
      file.size = stats.size;

      console.log(
        `🖼️ Image optimized: ${file.filename} (${formatBytes(file.size)} -> ${formatBytes(stats.size)})`,
      );

      processedFiles.push(file);
    } catch (error) {
      console.error(`Error processing image ${file.filename}:`, error);
      // Keep original file if processing fails
      processedFiles.push(file);
    }
  }

  return processedFiles;
};

// Middleware for event images with optimization
const uploadAndOptimizeEventImages = async (req, res, next) => {
  const uploadMultiple = upload.array("images", 5);

  uploadMultiple(req, res, async function (err) {
    if (err) {
      return handleUploadError(err, req, res, next);
    }

    if (req.files && req.files.length > 0) {
      try {
        // Process and optimize images
        req.files = await processEventImages(req.files);
      } catch (error) {
        console.error("Error optimizing images:", error);
        // Continue with original files if optimization fails
      }
    }

    next();
  });
};

// Middleware for both profile and cover photo upload
const uploadBoth = upload.fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "coverPhoto", maxCount: 1 },
]);

const uploadWithErrorHandling = (req, res, next) => {
  uploadBoth(req, res, function (err) {
    handleUploadError(err, req, res, next);
  });
};

// Error handling function
function handleUploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    // Multer-specific errors
    let errorMessage = `Upload error: ${err.message}`;

    if (err.code === "LIMIT_FILE_SIZE") {
      errorMessage = `File size is too large. Maximum size is 75MB.`;
    } else if (err.code === "LIMIT_FILE_COUNT") {
      errorMessage = "Too many files uploaded. Maximum is 5 images per event.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      errorMessage = 'Unexpected file field. Use "images" for event photos.';
    }

    console.error("❌ Multer error:", err.code, err.message);
    return res.status(400).json({
      success: false,
      message: errorMessage,
    });
  } else if (err) {
    // Other errors (file filter, etc.)
    console.error("❌ Upload error:", err.message);
    return res.status(400).json({
      success: false,
      message: err.message || "File upload failed",
    });
  }

  // Log successful file info
  if (req.files) {
    // Multiple files
    if (Array.isArray(req.files)) {
      // Event images array
      console.log(
        `✅ ${req.files.length} event image(s) uploaded successfully:`,
      );
      req.files.forEach((file) => {
        console.log(`  - ${file.filename} (${formatBytes(file.size)})`);
      });
    } else {
      // Object with fieldnames
      Object.keys(req.files).forEach((fieldname) => {
        req.files[fieldname].forEach((file) => {
          console.log(`✅ ${fieldname} uploaded successfully:`, {
            filename: file.filename,
            originalname: file.originalname,
            size: formatBytes(file.size),
            mimetype: file.mimetype,
            path: file.path,
          });
        });
      });
    }
  } else if (req.file) {
    // Single file
    console.log("✅ File uploaded successfully:", {
      fieldname: req.file.fieldname,
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: formatBytes(req.file.size),
      mimetype: req.file.mimetype,
      path: req.file.path,
    });
  }

  // No errors, proceed
  next();
}

// Helper function to format file size
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

// Helper to delete old image files
const deleteOldImage = async (filePath) => {
  if (!filePath) return false;

  try {
    // Extract relative path from full URL if needed
    let cleanPath = filePath;
    if (filePath.startsWith("http")) {
      const urlParts = filePath.split("/uploads/");
      if (urlParts[1]) {
        cleanPath = `uploads/${urlParts[1]}`;
      }
    }

    if (fs.existsSync(cleanPath)) {
      await fs.promises.unlink(cleanPath);
      console.log(`🗑️ Deleted old image: ${cleanPath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error deleting image ${filePath}:`, error);
  }
  return false;
};

module.exports = {
  uploadProfilePicture,
  uploadCoverPhoto,
  uploadEventImages,
  uploadEventImage,
  uploadAndOptimizeEventImages,
  uploadWithErrorHandling,
  deleteOldImage,
  formatBytes,
};
