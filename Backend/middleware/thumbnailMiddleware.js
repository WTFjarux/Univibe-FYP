// backend/middleware/thumbnailMiddleware.js
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

/**
 * Generate a video thumbnail using ffmpeg
 * Takes first meaningful frame at 1 second mark
 */
const generateVideoThumbnail = (videoPath, outputPath) => {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn("ffmpeg", [
      "-i",
      videoPath,
      "-ss",
      "00:00:01.000", // Seek to 1 second
      "-vframes",
      "1", // Extract 1 frame
      "-vf",
      "scale=400:-1", // Scale to 400px wide, maintain aspect ratio
      "-q:v",
      "5", // Quality (1-31, lower is better)
      "-y", // Overwrite output
      outputPath,
    ]);

    let stderr = "";
    ffmpeg.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        console.error("ffmpeg thumbnail error:", stderr);
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });

    ffmpeg.on("error", (err) => {
      console.error("ffmpeg spawn error:", err);
      reject(err);
    });
  });
};

/**
 * Generate thumbnails for uploaded files.
 * Now handles both images (via sharp) and videos (via ffmpeg).
 */
const generateThumbnails = async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);

  await Promise.all(
    files.map(async (file) => {
      try {
        if (file.mimetype?.startsWith("image/")) {
          // Existing image thumbnail logic
          const thumbPath = path.join(
            path.dirname(file.path),
            `thumb_${file.filename}`,
          );
          await sharp(file.path)
            .resize(200, 200, { fit: "cover" })
            .jpeg({ quality: 75 })
            .toFile(thumbPath);
          file.thumbnailUrl = `/uploads/chat/attachments/thumb_${file.filename}`;
        }
        // 🔴 NEW: Video thumbnail generation
        else if (file.mimetype?.startsWith("video/")) {
          const thumbFilename = `thumb_${file.filename.replace(/\.[^.]+$/, ".jpg")}`;
          const thumbPath = path.join(path.dirname(file.path), thumbFilename);

          try {
            await generateVideoThumbnail(file.path, thumbPath);
            file.thumbnailUrl = `/uploads/chat/attachments/${thumbFilename}`;
          } catch (err) {
            console.error("Video thumbnail generation failed:", err.message);
            // Silent fail - video will show default play button
          }
        }
      } catch (e) {
        // Silent fail - thumbnail is optional
        console.error("Thumbnail generation error:", e.message);
      }
    }),
  );
  next();
};

module.exports = { generateThumbnails };
