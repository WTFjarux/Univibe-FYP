/**
 * Upload Middleware
 *
 * Handles file uploads for:
 * - Profile pictures
 * - Cover photos
 * - Event images
 * - Audio messages (voice notes)
 * - Chat attachments (images, videos, documents)
 *
 * Features:
 * - Automatic directory creation
 * - File type validation
 * - Image optimization with Sharp
 * - Video metadata extraction with ffprobe
 * - Audio file support (mp3, m4a, aac, wav)
 * - Video file support (mp4, mov, avi, webm, 3gp, mkv)
 * - Document file support (pdf, doc, xls, ppt, txt, zip, rar)
 * - Error handling with user-friendly messages
 */

const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const { spawn } = require("child_process");

// ============================================
// DIRECTORY CONFIGURATION
// ============================================

const uploadDirectories = {
  profilePictures: "uploads/profile-pictures",
  coverPhotos: "uploads/cover-photos",
  eventImages: "uploads/events",
  chatAudio: "uploads/chat/audio",
  chatAttachments: "uploads/chat/attachments",
};

Object.values(uploadDirectories).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

console.log("Upload directories ready:");
console.log(`   Profile pictures: ${uploadDirectories.profilePictures}`);
console.log(`   Cover photos: ${uploadDirectories.coverPhotos}`);
console.log(`   Event images: ${uploadDirectories.eventImages}`);
console.log(`   Audio files: ${uploadDirectories.chatAudio}`);
console.log(`   Attachments: ${uploadDirectories.chatAttachments}`);

// ============================================
// HELPER FUNCTIONS
// ============================================

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

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
      console.log(`Deleted old image: ${cleanPath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error deleting image: ${error.message}`);
  }
  return false;
};

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
      console.log(`Deleted audio file: ${cleanPath}`);
      return true;
    }
  } catch (error) {
    console.error(`Error deleting audio: ${error.message}`);
  }
  return false;
};

// ============================================
// VIDEO METADATA EXTRACTION
// ============================================

const getVideoMetadata = (videoPath) => {
  return new Promise((resolve) => {
    const ffprobe = spawn("ffprobe", [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      videoPath,
    ]);

    let stdout = "";
    let stderr = "";

    ffprobe.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffprobe.on("error", (err) => {
      console.warn(`ffprobe not available: ${err.message}`);
      console.warn("   Install ffmpeg for video metadata extraction");
      resolve(null);
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        console.error(`ffprobe exited with code ${code}:`, stderr);
        resolve(null);
        return;
      }

      try {
        const metadata = JSON.parse(stdout);
        const videoStream = metadata.streams?.find(
          (s) => s.codec_type === "video",
        );

        if (!videoStream) {
          console.warn("No video stream found in file");
          resolve(null);
          return;
        }

        const result = {
          duration: parseFloat(metadata.format?.duration) || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          codec: videoStream.codec_name || "unknown",
          bitrate: parseInt(metadata.format?.bit_rate) || 0,
          fps: eval(videoStream.r_frame_rate) || 0,
          size: parseInt(metadata.format?.size) || 0,
        };

        console.log(
          `   Video metadata: ${result.width}x${result.height}, ${result.duration.toFixed(1)}s, ${result.codec}`,
        );

        resolve(result);
      } catch (err) {
        console.error("Failed to parse video metadata:", err.message);
        resolve(null);
      }
    });
  });
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
    attachments: uploadDirectories.chatAttachments,
    attachment: uploadDirectories.chatAttachments,
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

const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectories.chatAttachments);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || "unknown";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || ".bin";
    const filename = `attachment-${userId}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

// ============================================
// FILE FILTERS
// ============================================

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
    "video/3gpp",
    "video/x-matroska",
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
    ".3gp",
    ".mkv",
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
    cb(
      new Error(
        `File type not supported: ${file.originalname} (${file.mimetype})`,
      ),
      false,
    );
  }
};

const videoFileFilter = (req, file, cb) => {
  const allowedVideoTypes = [
    "video/mp4",
    "video/quicktime",
    "video/x-msvideo",
    "video/webm",
    "video/3gpp",
    "video/x-matroska",
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = [".mp4", ".mov", ".avi", ".webm", ".3gp", ".mkv"];

  if (allowedVideoTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Video format not supported: ${file.originalname}`), false);
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

const attachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 10,
  },
});

const videoUpload = multer({
  storage: attachmentStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 5,
  },
});

// ============================================
// Upload Group Photo Middleware
// ============================================

const groupPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/group-photos");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const uploadGroupPhoto = multer({
  storage: groupPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
}).single("image");

// ============================================
// Upload Community Photo Middleware
// ============================================

const communityPhotoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/group-photos");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `community_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const uploadCommunityPhoto = multer({
  storage: communityPhotoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only images are allowed"));
    }
  },
}).single("coverImage");

// ============================================
// ERROR HANDLER
// ============================================

const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let errorMessage = `Upload error: ${err.message}`;

    if (err.code === "LIMIT_FILE_SIZE") {
      const maxSize =
        err.field === "audio"
          ? "25MB"
          : err.field === "video"
            ? "200MB"
            : err.field === "attachments"
              ? "200MB"
              : "75MB";
      errorMessage = `File size too large. Maximum: ${maxSize}.`;
    } else if (err.code === "LIMIT_FILE_COUNT") {
      errorMessage = `Too many files. Maximum ${err.field === "video" ? "5 videos" : "10 files"} allowed.`;
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      errorMessage = `Unexpected file field: "${err.field}". Please use the correct field name.`;
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
// EXPORTED MIDDLEWARES - Image Uploads
// ============================================

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
// EXPORTED MIDDLEWARES - Audio Uploads
// ============================================

const uploadAudioMessage = (req, res, next) => {
  console.log("[uploadAudioMessage] Processing audio upload...");

  audioUpload.single("audio")(req, res, (err) => {
    if (err) {
      console.error("Multer error:", err);
      return handleUploadError(err, req, res, next);
    }

    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log("Audio file saved successfully:");
        console.log(`   Path: ${filePath}`);
        console.log(`   Filename: ${req.file.filename}`);
        console.log(`   Size: ${formatBytes(stats.size)}`);
        console.log(`   Type: ${req.file.mimetype}`);
      } else {
        console.error("File not found at path after save:", filePath);
      }

      req.audioInfo = {
        filename: req.file.filename,
        url: `/uploads/chat/audio/${req.file.filename}`,
        size: req.file.size,
        mimetype: req.file.mimetype,
      };
    } else {
      console.error("No file in request after multer processing");
    }

    next();
  });
};

const deleteAudioFileIfExists = async (fileUrl) => {
  return await deleteAudioFile(fileUrl);
};

// ============================================
// EXPORTED MIDDLEWARES - Attachment Uploads
// ============================================

const uploadAttachments = (req, res, next) => {
  console.log("[uploadAttachments] Processing attachment upload...");

  attachmentUpload.array("attachments", 10)(req, res, async (err) => {
    if (err) {
      console.error("Attachment upload error:", err);
      return handleUploadError(err, req, res, next);
    }

    if (req.files && req.files.length > 0) {
      console.log(`${req.files.length} attachment(s) saved successfully:`);

      req.attachmentsInfo = await Promise.all(
        req.files.map(async (file) => {
          const filePath = file.path;

          if (!fs.existsSync(filePath)) {
            console.warn(`File not found: ${filePath}`);
            return null;
          }

          const stats = fs.statSync(filePath);

          let attachmentType = "file";
          if (file.mimetype?.startsWith("image/")) {
            attachmentType = "image";
          } else if (file.mimetype?.startsWith("video/")) {
            attachmentType = "video";
          }

          let videoMetadata = null;
          if (attachmentType === "video") {
            videoMetadata = await getVideoMetadata(filePath);
            if (videoMetadata) {
              file.metadata = videoMetadata;
            }
          }

          console.log(
            `   ${file.originalname} (${formatBytes(stats.size)}) [${attachmentType}]`,
          );

          return {
            filename: file.filename,
            originalname: file.originalname,
            url: `/uploads/chat/attachments/${file.filename}`,
            size: file.size,
            mimetype: file.mimetype,
            type: attachmentType,
            metadata: videoMetadata,
          };
        }),
      );

      req.attachmentsInfo = req.attachmentsInfo.filter(Boolean);
    } else {
      console.log("No files in request (may be location share)");
    }

    next();
  });
};

const uploadSingleAttachment = (req, res, next) => {
  console.log(
    "[uploadSingleAttachment] Processing single attachment upload...",
  );

  attachmentUpload.single("attachment")(req, res, async (err) => {
    if (err) {
      console.error("Attachment upload error:", err);
      return handleUploadError(err, req, res, next);
    }

    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log("Attachment saved successfully:");
        console.log(`   Path: ${filePath}`);
        console.log(`   Filename: ${req.file.filename}`);
        console.log(`   Size: ${formatBytes(stats.size)}`);
        console.log(`   Type: ${req.file.mimetype}`);

        let attachmentType = "file";
        if (req.file.mimetype?.startsWith("image/")) {
          attachmentType = "image";
        } else if (req.file.mimetype?.startsWith("video/")) {
          attachmentType = "video";

          const videoMetadata = await getVideoMetadata(filePath);
          if (videoMetadata) {
            req.file.metadata = videoMetadata;
          }
        }

        req.attachmentInfo = {
          filename: req.file.filename,
          originalname: req.file.originalname,
          url: `/uploads/chat/attachments/${req.file.filename}`,
          size: req.file.size,
          mimetype: req.file.mimetype,
          type: attachmentType,
          metadata: req.file.metadata || null,
        };
      }
    } else {
      console.error("No file in request after multer processing");
    }

    next();
  });
};

const uploadVideo = (req, res, next) => {
  console.log("[uploadVideo] Processing video upload...");

  videoUpload.single("video")(req, res, async (err) => {
    if (err) {
      console.error("Video upload error:", err);
      return handleUploadError(err, req, res, next);
    }

    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log("Video saved successfully:");
        console.log(`   Path: ${filePath}`);
        console.log(`   Filename: ${req.file.filename}`);
        console.log(`   Size: ${formatBytes(stats.size)}`);
        console.log(`   Type: ${req.file.mimetype}`);

        const videoMetadata = await getVideoMetadata(filePath);
        if (videoMetadata) {
          req.file.metadata = videoMetadata;
        }

        req.videoInfo = {
          filename: req.file.filename,
          url: `/uploads/chat/attachments/${req.file.filename}`,
          size: req.file.size,
          mimetype: req.file.mimetype,
          type: "video",
          metadata: videoMetadata,
        };
      } else {
        console.error("Video file not found at path:", filePath);
      }
    } else {
      console.error("No video file in request");
    }

    next();
  });
};

// ============================================
// Story Media Upload
// ============================================

const storyMediaStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../uploads/stories");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const userId = req.user?.id || req.user?._id || "unknown";
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const filename = `story-${userId}-${uniqueSuffix}${ext}`;
    cb(null, filename);
  },
});

const storyMediaFileFilter = (req, file, cb) => {
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
    "video/3gpp",
    "video/x-matroska",
  ];

  const allowed = [...allowedImageTypes, ...allowedVideoTypes];
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
    ".3gp",
    ".mkv",
  ];

  if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Story media type not supported: ${file.originalname}`),
      false,
    );
  }
};

const storyMediaUpload = multer({
  storage: storyMediaStorage,
  fileFilter: storyMediaFileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB
  },
});

const uploadStoryMedia = (req, res, next) => {
  console.log("[uploadStoryMedia] Processing story media upload...");

  storyMediaUpload.single("media")(req, res, async (err) => {
    if (err) {
      console.error("Story media upload error:", err);
      return handleUploadError(err, req, res, next);
    }

    if (req.file) {
      const filePath = req.file.path;
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log("Story media saved successfully:");
        console.log(`   Path: ${filePath}`);
        console.log(`   Filename: ${req.file.filename}`);
        console.log(`   Size: ${formatBytes(stats.size)}`);
        console.log(`   Type: ${req.file.mimetype}`);

        let mediaType = "image";
        if (req.file.mimetype?.startsWith("video/")) {
          mediaType = "video";
        }

        req.storyMediaInfo = {
          filename: req.file.filename,
          url: `/uploads/stories/${req.file.filename}`,
          size: req.file.size,
          mimetype: req.file.mimetype,
          type: mediaType,
        };
      } else {
        console.error("Story media file not found at path:", filePath);
      }
    } else {
      console.error("No media file in request");
    }

    next();
  });
};

// ============================================
// EXPORTS
// ============================================

module.exports = {
  uploadProfilePicture,
  uploadCoverPhoto,
  uploadEventImages,
  uploadEventImage,
  uploadAndOptimizeEventImages,
  uploadGroupPhoto,
  uploadWithErrorHandling,
  uploadAudioMessage,
  deleteAudioFileIfExists,
  uploadAttachments,
  uploadSingleAttachment,
  uploadVideo,
  uploadStoryMedia,
  uploadStoryMedia,
  getVideoMetadata,
  deleteOldImage,
  formatBytes,
  uploadCommunityPhoto,
};
