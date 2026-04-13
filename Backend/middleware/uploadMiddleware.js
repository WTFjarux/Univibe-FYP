/**
 * Upload Middleware
 *
 * Handles file uploads for:
 * - Profile pictures
 * - Cover photos
 * - Event images
 * - Audio messages (voice notes)
 *
 * Features:
 * - Automatic directory creation
 * - File type validation
 * - Image optimization with Sharp
 * - Audio file support (mp3, m4a, aac, wav)
 * - Error handling with user-friendly messages
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");

// ============================================
// DIRECTORY CONFIGURATION
// ============================================

const uploadDirectories = {
  profilePictures: "uploads/profile-pictures",
  coverPhotos: "uploads/cover-photos",
  eventImages: "uploads/events",
  chatAudio: "uploads/chat/audio", // New: Audio messages directory
};

// Create all required directories
Object.values(uploadDirectories).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format file size for logging
 * @param {number} bytes - File size in bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted file size
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

/**
 * Delete old image file
 * @param {string} filePath - Path to file to delete
 * @returns {Promise<boolean>} Success status
 */
const deleteOldImage = async (filePath) => {
  if (!filePath) return false;
  try {
    let cleanPath = filePath;
    if (filePath.startsWith("http")) {
      const urlParts = filePath.split("/uploads/");
      if (urlParts[1]) cleanPath = `uploads/${urlParts[1]}`;
    }
    if (fs.existsSync(cleanPath)) {
      await fs.promises.unlink(cleanPath);
      return true;
    }
  } catch (error) {
    console.error(`Error deleting image: ${error.message}`);
  }
  return false;
};

/**
 * Delete audio file
 * @param {string} filePath - Path to audio file
 * @returns {Promise<boolean>} Success status
 */
const deleteAudioFile = async (filePath) => {
  if (!filePath) return false;
  try {
    let cleanPath = filePath;
    if (filePath.startsWith("http")) {
      const urlParts = filePath.split("/uploads/");
      if (urlParts[1]) cleanPath = `uploads/${urlParts[1]}`;
    }
    if (fs.existsSync(cleanPath)) {
      await fs.promises.unlink(cleanPath);
      return true;
    }
  } catch (error) {
    console.error(`Error deleting audio: ${error.message}`);
  }
  return false;
};

// ============================================
// STORAGE CONFIGURATION
// ============================================

const getDestination = (fieldname) => {
  const destinations = {
    profilePicture: uploadDirectories.profilePictures,
    coverPhoto: uploadDirectories.coverPhotos,
    images: uploadDirectories.eventImages,
    eventImage: uploadDirectories.eventImages,
    audio: uploadDirectories.chatAudio, // New: Audio destination
  };
  return destinations[fieldname] || uploadDirectories.eventImages;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = getDestination(file.fieldname);
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || req.user?._id || "unknown";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    let ext = path.extname(file.originalname).toLowerCase();

    // Handle iPhone HEIC/HEIF photos
    if (ext === ".heic" || ext === ".heif") {
      ext = ".jpg";
    }

    if (!ext) ext = ".jpg";

    let prefix = file.fieldname;
    if (file.fieldname === "images") prefix = "event";
    if (file.fieldname === "audio") prefix = "voice";

    const filename = `${prefix}-${userId}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// ============================================
// FILE FILTERS
// ============================================

/**
 * Image file filter - Allows images and iPhone HEIC/HEIF
 */
const imageFileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isHeic = ext === ".heic" || ext === ".heif";
  const isImage = file.mimetype.startsWith("image/");

  if (isImage || isHeic) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

/**
 * Audio file filter - Allows common audio formats
 */
const audioFileFilter = (req, file, cb) => {
  const allowedAudioTypes = [
    "audio/mpeg", // mp3
    "audio/mp3", // mp3
    "audio/m4a", // m4a (iPhone voice memos)
    "audio/aac", // aac
    "audio/wav", // wav
    "audio/x-m4a", // m4a alternative
  ];

  const isAudio = allowedAudioTypes.includes(file.mimetype);
  const ext = path.extname(file.originalname).toLowerCase();
  const isAudioExt = [".mp3", ".m4a", ".aac", ".wav"].includes(ext);

  if (isAudio || isAudioExt) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed (mp3, m4a, aac, wav)"), false);
  }
};

// ============================================
// MULTER INSTANCES
// ============================================

// Image upload (75MB limit)
const imageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 75 * 1024 * 1024, files: 10 },
});

// Audio upload (25MB limit for voice messages)
const audioUpload = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
});

// ============================================
// ERROR HANDLER
// ============================================

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let errorMessage = `Upload error: ${err.message}`;
    if (err.code === "LIMIT_FILE_SIZE") {
      errorMessage = `File size too large. Maximum: ${err.field === "audio" ? "25MB" : "75MB"}.`;
    } else if (err.code === "LIMIT_FILE_COUNT") {
      errorMessage = "Too many files. Maximum 5 images per event.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      errorMessage = 'Unexpected file field. Use "images" for event photos.';
    }
    return res.status(400).json({ success: false, message: errorMessage });
  } else if (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
  next();
};

// ============================================
// IMAGE PROCESSING
// ============================================

/**
 * Process and optimize images with Sharp
 */
const processEventImages = async (files) => {
  if (!files?.length) return files;
  const processedFiles = [];

  for (const file of files) {
    try {
      if (!file.path || !fs.existsSync(file.path)) {
        processedFiles.push(file);
        continue;
      }

      let sharpInstance = sharp(file.path);
      const metadata = await sharpInstance.metadata();

      if (metadata.width && metadata.width > 1920) {
        sharpInstance = sharpInstance.resize(1920, null, {
          withoutEnlargement: true,
          fit: "inside",
        });
      }

      const ext = path.extname(file.filename).toLowerCase();
      if (ext === ".jpg" || ext === ".jpeg") {
        sharpInstance = sharpInstance.jpeg({ quality: 80, progressive: true });
      } else if (ext === ".png") {
        sharpInstance = sharpInstance.png({ quality: 80, compressionLevel: 8 });
      } else if (ext === ".webp") {
        sharpInstance = sharpInstance.webp({ quality: 80 });
      }

      await sharpInstance.toFile(file.path + ".tmp");
      fs.unlinkSync(file.path);
      fs.renameSync(file.path + ".tmp", file.path);

      processedFiles.push(file);
    } catch (error) {
      console.error(`Image processing error: ${error.message}`);
      processedFiles.push(file);
    }
  }
  return processedFiles;
};

// ============================================
// EXPORTED MIDDLEWARES
// ============================================

// Image uploads
const uploadProfilePicture = (req, res, next) => {
  imageUpload.single("profilePicture")(req, res, (err) =>
    handleUploadError(err, req, res, next),
  );
};

const uploadCoverPhoto = (req, res, next) => {
  imageUpload.single("coverPhoto")(req, res, (err) =>
    handleUploadError(err, req, res, next),
  );
};

const uploadEventImages = (req, res, next) => {
  imageUpload.array("images", 5)(req, res, (err) =>
    handleUploadError(err, req, res, next),
  );
};

const uploadEventImage = (req, res, next) => {
  imageUpload.single("eventImage")(req, res, (err) =>
    handleUploadError(err, req, res, next),
  );
};

const uploadAndOptimizeEventImages = async (req, res, next) => {
  imageUpload.array("images", 5)(req, res, async (err) => {
    if (err) return handleUploadError(err, req, res, next);
    if (req.files?.length) {
      req.files = await processEventImages(req.files);
    }
    next();
  });
};

const uploadBoth = imageUpload.fields([
  { name: "profilePicture", maxCount: 1 },
  { name: "coverPhoto", maxCount: 1 },
]);

const uploadWithErrorHandling = (req, res, next) => {
  uploadBoth(req, res, (err) => handleUploadError(err, req, res, next));
};

// ============================================
// NEW: AUDIO UPLOAD MIDDLEWARE
// ============================================

/**
 * Upload single audio file for voice messages
 * Returns the file info for further processing
 */
const uploadAudioMessage = (req, res, next) => {
  audioUpload.single("audio")(req, res, (err) => {
    if (err) return handleUploadError(err, req, res, next);
    if (req.file) {
      // Add audio metadata for response
      req.audioInfo = {
        filename: req.file.filename,
        url: `/uploads/chat/audio/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
      };
    }
    next();
  });
};

/**
 * Delete audio file after message is deleted or failed
 */
const deleteAudioFileIfExists = async (fileUrl) => {
  return await deleteAudioFile(fileUrl);
};

module.exports = {
  // Image uploads
  uploadProfilePicture,
  uploadCoverPhoto,
  uploadEventImages,
  uploadEventImage,
  uploadAndOptimizeEventImages,
  uploadWithErrorHandling,

  // Audio uploads
  uploadAudioMessage,
  deleteAudioFileIfExists,

  // Utilities
  deleteOldImage,
  formatBytes,
};
