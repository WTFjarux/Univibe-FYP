const multer = require("multer");
const path = require("path");
const fs = require("fs");
const sharp = require("sharp");
const heicConvert = require("heic-convert");

// Ensure upload directory exists
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// ============================================
// HELPER: Convert HEIC/HEIF to JPEG
// ============================================
const convertHeicToJpeg = async (inputBuffer) => {
  try {
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: "JPEG",
      quality: 0.8,
    });
    return outputBuffer;
  } catch (error) {
    console.error("HEIC conversion error:", error);
    throw new Error("Failed to convert HEIC image");
  }
};

// ============================================
// HELPER: Process and optimize image
// ============================================
const processImage = async (inputBuffer, originalName, mimetype) => {
  let processedBuffer = inputBuffer;
  let finalMimetype = mimetype;
  let finalExtension = path.extname(originalName).toLowerCase();

  // Check if it's HEIC/HEIF format (iPhone default format)
  const isHeic =
    mimetype === "image/heic" ||
    mimetype === "image/heif" ||
    finalExtension === ".heic" ||
    finalExtension === ".heif";

  if (isHeic) {
    // Convert HEIC to JPEG
    processedBuffer = await convertHeicToJpeg(inputBuffer);
    finalMimetype = "image/jpeg";
    finalExtension = ".jpg";
  }

  // Optimize image with sharp (resize if too large, compress)
  try {
    let sharpInstance = sharp(processedBuffer);

    // Get image metadata
    const metadata = await sharpInstance.metadata();

    // Resize if width > 1920px (maintain aspect ratio)
    if (metadata.width && metadata.width > 1920) {
      sharpInstance = sharpInstance.resize(1920, null, {
        withoutEnlargement: true,
        fit: "inside",
      });
    }

    // Compress based on format
    if (finalMimetype === "image/jpeg") {
      sharpInstance = sharpInstance.jpeg({ quality: 80, progressive: true });
    } else if (finalMimetype === "image/png") {
      sharpInstance = sharpInstance.png({ quality: 80, compressionLevel: 8 });
    } else if (finalMimetype === "image/webp") {
      sharpInstance = sharpInstance.webp({ quality: 80 });
    }

    processedBuffer = await sharpInstance.toBuffer();
  } catch (error) {
    console.error("Image optimization error:", error);
    // If optimization fails, use original buffer
  }

  return {
    buffer: processedBuffer,
    mimetype: finalMimetype,
    extension: finalExtension,
  };
};

// Configure storage for event images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/events/";
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: async (req, file, cb) => {
    try {
      // Process file buffer if it's HEIC
      if (file.buffer) {
        const isHeic =
          file.mimetype === "image/heic" ||
          file.mimetype === "image/heif" ||
          path.extname(file.originalname).toLowerCase() === ".heic" ||
          path.extname(file.originalname).toLowerCase() === ".heif";

        if (isHeic) {
          const converted = await convertHeicToJpeg(file.buffer);
          file.buffer = converted;
          file.mimetype = "image/jpeg";
        }
      }

      // Create unique filename
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase();

      // Replace .heic/.heif with .jpg
      const finalExt = ext === ".heic" || ext === ".heif" ? ".jpg" : ext;
      cb(null, `event-${uniqueSuffix}${finalExt}`);
    } catch (error) {
      console.error("Error processing filename:", error);
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      cb(null, `event-${uniqueSuffix}.jpg`);
    }
  },
});

// File filter to allow HEIC/HEIF images from iPhone
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/heic", // iPhone HEIC format
    "image/heif", // iPhone HEIF format
  ];

  const allowedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".heic",
    ".heif",
  ];
  const extname = allowedExtensions.includes(
    path.extname(file.originalname).toLowerCase(),
  );
  const mimetype = allowedTypes.includes(file.mimetype);

  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only image files (JPEG, PNG, GIF, WEBP, HEIC, HEIF) are allowed",
      ),
      false,
    );
  }
};

// ============================================
// CUSTOM STORAGE WITH BUFFER SUPPORT
// ============================================
// This allows us to process files before saving
const multerStorage = multer.memoryStorage(); // Use memory storage first for processing

const multerUpload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for iPhone images (HEIC can be larger)
    files: 5,
  },
  fileFilter: fileFilter,
});

// Process and save file after conversion
const processAndSaveFile = async (file, destination, filename) => {
  try {
    // Process the image (convert HEIC, resize, compress)
    const processed = await processImage(
      file.buffer,
      file.originalname,
      file.mimetype,
    );

    // Save processed file
    const filePath = path.join(destination, filename);
    await fs.promises.writeFile(filePath, processed.buffer);

    return {
      filename: file.originalname,
      url: `/uploads/events/${filename}`,
      path: filePath,
      mimetype: processed.mimetype,
      size: processed.buffer.length,
    };
  } catch (error) {
    console.error("Error processing and saving file:", error);
    throw error;
  }
};

// ============================================
// MIDDLEWARE: Handle multiple image uploads with processing
// ============================================
const uploadEventImages = async (req, res, next) => {
  // Use multer to parse files
  multerUpload.array("images", 5)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "FILE_LIMIT") {
        return res.status(400).json({
          success: false,
          message: "You can upload maximum 5 images per event",
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    } else if (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // If no files, proceed
    if (!req.files || req.files.length === 0) {
      return next();
    }

    try {
      // Process each file
      const uploadDir = "uploads/events/";
      ensureDirectoryExists(uploadDir);

      const processedFiles = [];

      for (const file of req.files) {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname).toLowerCase();
        const finalExt = ext === ".heic" || ext === ".heif" ? ".jpg" : ext;
        const filename = `event-${uniqueSuffix}${finalExt}`;

        const processedFile = await processAndSaveFile(
          file,
          uploadDir,
          filename,
        );
        processedFiles.push({
          ...processedFile,
          originalBuffer: undefined, // Remove buffer to save memory
        });
      }

      // Replace req.files with processed files
      req.files = processedFiles;
      next();
    } catch (error) {
      console.error("Error processing images:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to process images. Please try again.",
      });
    }
  });
};

// For backward compatibility - single image upload
const uploadEventImage = async (req, res, next) => {
  multerUpload.single("coverImage")(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({
          success: false,
          message: err.message,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (req.file) {
      try {
        const uploadDir = "uploads/events/";
        ensureDirectoryExists(uploadDir);

        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(req.file.originalname).toLowerCase();
        const finalExt = ext === ".heic" || ext === ".heif" ? ".jpg" : ext;
        const filename = `event-${uniqueSuffix}${finalExt}`;

        const processedFile = await processAndSaveFile(
          req.file,
          uploadDir,
          filename,
        );
        req.file = processedFile;
      } catch (error) {
        console.error("Error processing single image:", error);
        return res.status(500).json({
          success: false,
          message: "Failed to process image",
        });
      }
    }

    next();
  });
};

module.exports = {
  uploadEventImage,
  uploadEventImages,
};
