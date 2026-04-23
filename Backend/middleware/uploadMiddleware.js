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
  chatAudio: "uploads/chat/audio",
};

// Create all required directories
Object.values(uploadDirectories).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

console.log("📁 Upload directories ready:");
console.log(`   Audio files will be saved to: ${uploadDirectories.chatAudio}`);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format file size for logging
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
      console.log(`🗑️ Deleted old image: ${cleanPath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error deleting image: ${error.message}`);
  }
  return false;
};

/**
 * Delete audio file
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
      console.log(`🗑️ Deleted audio file: ${cleanPath}`);
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
    audio: uploadDirectories.chatAudio,
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
 * Image file filter
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
    "audio/mpeg",
    "audio/mp3",
    "audio/m4a",
    "audio/aac",
    "audio/wav",
    "audio/x-m4a",
    "audio/x-wav",
    "application/octet-stream",
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const isAudioExt = [".mp3", ".m4a", ".aac", ".wav", ".m4r"].includes(ext);
  const isAudio = allowedAudioTypes.includes(file.mimetype) || isAudioExt;

  if (isAudio) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed (mp3, m4a, aac, wav)"), false);
  }
};

// ============================================
// MULTER INSTANCES
// ============================================

const imageUpload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 75 * 1024 * 1024, files: 10 },
});

const audioUpload = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
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
// AUDIO UPLOAD MIDDLEWARE (UPDATED)
// ============================================

/**
 * Upload single audio file for voice messages
 * Returns the file info for further processing
 */
const uploadAudioMessage = (req, res, next) => {
  console.log("🔊 [uploadAudioMessage] Processing audio upload...");

  audioUpload.single("audio")(req, res, (err) => {
    if (err) {
      console.error("❌ Multer error:", err);
      return handleUploadError(err, req, res, next);
    }

    if (req.file) {
      // Verify file was actually saved
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log("✅ Audio file saved successfully:");
        console.log(`   📁 Path: ${filePath}`);
        console.log(`   📝 Filename: ${req.file.filename}`);
        console.log(`   📏 Size: ${formatBytes(stats.size)}`);
        console.log(`   🎵 Type: ${req.file.mimetype}`);
      } else {
        console.error("❌ File not found at path after save:", filePath);
      }

      // Add audio metadata for response
      req.audioInfo = {
        filename: req.file.filename,
        url: `/uploads/chat/audio/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
      };
      console.log("📦 audioInfo set:", req.audioInfo);
    } else {
      console.error("❌ No file in request after multer processing");
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

// ============================================
// 🔴 Updated: ATTACHMENT UPLOAD CONFIGURATION (Multiple Files)
// ============================================

// Ensure attachment directory exists
const attachmentDir = "uploads/chat/attachments";
if (!fs.existsSync(attachmentDir)) {
  fs.mkdirSync(attachmentDir, { recursive: true });
  console.log(`✅ Created directory: ${attachmentDir}`);
}

/**
 * Attachment file filter - Allows images, videos, documents
 */
const attachmentFileFilter = (req, file, cb) => {
  const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic",
    "image/heif",
  ];
  const allowedVideoTypes = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
  ];
  const allowedDocTypes = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/plain",
    "application/zip",
    "application/x-rar-compressed",
    "application/octet-stream",
  ];

  const allAllowed = [
    ...allowedImageTypes,
    ...allowedVideoTypes,
    ...allowedDocTypes,
  ];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".heic",
    ".heif",
    ".mp4",
    ".mov",
    ".avi",
    ".webm",
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".txt",
    ".csv",
    ".zip",
    ".rar",
  ];

  if (allAllowed.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not supported: ${file.originalname}`), false);
  }
};

// 🔴 Storage for multiple attachments
const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentDir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || "unknown";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const filename = `attachment-${userId}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// 🔴 Updated: Allow up to 10 files, 50MB each
const attachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB per file
    files: 10, // Max 10 files per upload
  },
});

/**
 * 🔴 Upload multiple attachments (images, videos, documents)
 * Supports up to 10 files in a single request
 */
const uploadAttachments = (req, res, next) => {
  console.log("📎 [uploadAttachments] Processing attachment upload...");

  // Accept multiple files with field name "attachments"
  attachmentUpload.array("attachments", 10)(req, res, (err) => {
    if (err) {
      console.error("❌ Attachment upload error:", err);
      return handleUploadError(err, req, res, next);
    }

    if (req.files && req.files.length > 0) {
      console.log(`✅ ${req.files.length} attachment(s) saved successfully:`);

      req.attachmentsInfo = req.files
        .map((file) => {
          const filePath = file.path;
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            console.log(
              `   📁 ${file.originalname} (${formatBytes(stats.size)})`,
            );

            // Determine attachment type
            let attachmentType = "file";
            if (file.mimetype.startsWith("image/")) attachmentType = "image";
            else if (file.mimetype.startsWith("video/"))
              attachmentType = "video";

            return {
              filename: file.filename,
              originalname: file.originalname,
              url: `/uploads/chat/attachments/${file.filename}`,
              size: file.size,
              mimetype: file.mimetype,
              type: attachmentType,
            };
          }
          return null;
        })
        .filter(Boolean);
    } else {
      console.log("ℹ️ No files in request (may be location share)");
    }

    next();
  });
};

/**
 * 🔴 Also keep single file upload for backward compatibility
 */
const uploadSingleAttachment = (req, res, next) => {
  console.log(
    "📎 [uploadSingleAttachment] Processing single attachment upload...",
  );

  attachmentUpload.single("attachment")(req, res, (err) => {
    if (err) {
      console.error("❌ Attachment upload error:", err);
      return handleUploadError(err, req, res, next);
    }

    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log("✅ Attachment saved successfully:");
        console.log(`   📁 Path: ${filePath}`);
        console.log(`   📝 Filename: ${req.file.filename}`);
        console.log(`   📏 Size: ${formatBytes(stats.size)}`);
        console.log(`   📎 Type: ${req.file.mimetype}`);

        let attachmentType = "file";
        if (req.file.mimetype.startsWith("image/")) attachmentType = "image";
        else if (req.file.mimetype.startsWith("video/"))
          attachmentType = "video";

        req.attachmentInfo = {
          filename: req.file.filename,
          originalname: req.file.originalname,
          url: `/uploads/chat/attachments/${req.file.filename}`,
          size: req.file.size,
          mimetype: req.file.mimetype,
          type: attachmentType,
        };
      }
    } else {
      console.error("❌ No file in request after multer processing");
    }

    next();
  });
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

  // Attachment uploads 
  uploadAttachments,
  uploadSingleAttachment,

  // Utilities
  deleteOldImage,
  formatBytes,
};
