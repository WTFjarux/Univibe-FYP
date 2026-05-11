const cron = require("node-cron");
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const Notification = require("../models/Notification");

/**
 * Cleanup job to permanently delete posts that have been soft-deleted for 30+ days
 * Runs daily at 2:00 AM
 */

// Track if cleanup is running to prevent overlapping
let isRunning = false;

const runCleanup = async () => {
  if (isRunning) {
    console.log("⚠️ [Cleanup] Previous cleanup still running, skipping...");
    return;
  }

  isRunning = true;
  const startTime = Date.now();

  console.log("\n🧹 [Cleanup] Starting cleanup of old deleted posts...");
  console.log(`   Time: ${new Date().toISOString()}`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    console.log(
      `   Deleting posts deleted before: ${cutoffDate.toISOString()}`,
    );

    const oldDeletedPosts = await Post.find({
      isDeleted: true,
      deletedAt: { $lt: cutoffDate },
    }).includeDeleted();

    if (oldDeletedPosts.length === 0) {
      console.log("✅ [Cleanup] No old posts to delete");
      return { success: true, deleted: 0 };
    }

    console.log(
      `   Found ${oldDeletedPosts.length} posts to permanently delete`,
    );

    let deletedCount = 0;
    let failedCount = 0;

    for (const post of oldDeletedPosts) {
      try {
        // Delete associated comments
        const commentResult = await Comment.deleteMany({ post: post._id });

        // Delete associated notifications
        const notifResult = await Notification.deleteMany({
          targetId: post._id,
          targetModel: "Post",
        });

        // Delete associated images if any
        if (post.images && post.images.length > 0) {
          const fs = require("fs");
          post.images.forEach((image) => {
            if (image.path && fs.existsSync(image.path)) {
              try {
                fs.unlinkSync(image.path);
              } catch (err) {
                console.error(
                  `   ⚠️ Failed to delete image: ${image.path}`,
                  err.message,
                );
              }
            }
          });
        }

        // Permanently delete the post
        await Post.deleteOne({ _id: post._id });
        deletedCount++;

        console.log(
          `   ✅ Deleted post: ${post._id} (deleted on: ${post.deletedAt?.toISOString()})`,
        );
      } catch (error) {
        failedCount++;
        console.error(
          `   ❌ Failed to delete post ${post._id}:`,
          error.message,
        );
        // Continue with next post
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log(`\n✅ [Cleanup] Completed in ${duration}s`);
    console.log(`   Successfully deleted: ${deletedCount} posts`);
    if (failedCount > 0) {
      console.log(`   Failed to delete: ${failedCount} posts`);
    }

    return {
      success: true,
      deleted: deletedCount,
      failed: failedCount,
      duration: `${duration}s`,
    };
  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`❌ [Cleanup] Failed after ${duration}s:`, error);

    return {
      success: false,
      error: error.message,
    };
  } finally {
    isRunning = false;
  }
};

// Start the cleanup job
const startCleanupJob = () => {
  // Schedule to run daily at 2:00 AM
  // Cron format: minute hour day-of-month month day-of-week
  cron.schedule("0 2 * * *", runCleanup, {
    scheduled: true,
    timezone: "Asia/Kathmandu", // Change to your timezone or "UTC"
  });

  console.log("🧹 Post cleanup cron job scheduled (daily at 2:00 AM)");

  // Run immediately on startup if environment variable is set
  if (process.env.RUN_CLEANUP_ON_START === "true") {
    console.log("🧹 Running initial cleanup on startup...");
    // Small delay to ensure everything is ready
    setTimeout(() => {
      runCleanup();
    }, 3000);
  }
};

module.exports = { startCleanupJob, runCleanup };
