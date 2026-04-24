// backend/middleware/thumbnailMiddleware.js
const sharp = require("sharp");
const path = require("path");

/**
 * Generate 200px thumbnail for every uploaded image.
 * Attach thumbnailUrl to file object.
 */
const generateThumbnails = async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);

  await Promise.all(
    files.map(async (file) => {
      if (file.mimetype?.startsWith("image/")) {
        try {
          const thumbPath = path.join(
            path.dirname(file.path),
            `thumb_${file.filename}`,
          );
          await sharp(file.path)
            .resize(200, 200, { fit: "cover" })
            .jpeg({ quality: 75 })
            .toFile(thumbPath);
          file.thumbnailUrl = `/uploads/chat/attachments/thumb_${file.filename}`;
        } catch (e) {
          // Silent fail - thumbnail is optional
        }
      }
    }),
  );
  next();
};

module.exports = { generateThumbnails };
