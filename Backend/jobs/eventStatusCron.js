/**
 * jobs/eventStatusCron.js
 *
 * Cron job that automatically updates event statuses based on current time.
 * Runs every 60 seconds to ensure events properly transition:
 *   upcoming → ongoing → completed
 */

const Event = require("../models/Event");

/**
 * Update event statuses based on current time
 * This should be run periodically to ensure events transition properly
 */
const updateEventStatuses = async () => {
  try {
    const now = new Date();

    // Update upcoming → ongoing
    const toOngoing = await Event.updateMany(
      {
        status: "upcoming",
        startDate: { $lte: now },
        endDate: { $gte: now },
      },
      { $set: { status: "ongoing" } },
    );

    // Update upcoming/ongoing → completed
    const toCompleted = await Event.updateMany(
      {
        status: { $in: ["upcoming", "ongoing"] },
        endDate: { $lt: now },
      },
      { $set: { status: "completed" } },
    );

    const totalUpdated =
      (toOngoing.modifiedCount || 0) + (toCompleted.modifiedCount || 0);

    if (totalUpdated > 0) {
      console.log(
        `📅 Event Status Cron: ${toOngoing.modifiedCount || 0} → ongoing, ${toCompleted.modifiedCount || 0} → completed (${new Date().toLocaleTimeString()})`,
      );
    }

    return {
      toOngoing: toOngoing.modifiedCount || 0,
      toCompleted: toCompleted.modifiedCount || 0,
      totalUpdated,
    };
  } catch (error) {
    console.error("❌ Event Status Cron Error:", error);
    return { toOngoing: 0, toCompleted: 0, totalUpdated: 0 };
  }
};

/**
 * Start the cron job that periodically updates event statuses
 * @param {number} intervalMs - Interval in milliseconds (default: 60000 = 1 minute)
 * @returns {number} The interval ID so it can be cleared if needed
 */
const startEventStatusCron = (intervalMs = 60000) => {
  console.log(
    `🕒 Event Status Cron: Started (running every ${intervalMs / 1000}s)`,
  );

  // Run immediately on startup
  updateEventStatuses();

  // Then run at specified interval
  const intervalId = setInterval(updateEventStatuses, intervalMs);

  // Return the interval ID so it can be cleared if needed (for graceful shutdown)
  return intervalId;
};

/**
 * Stop the cron job
 * @param {number} intervalId - The interval ID returned by startEventStatusCron
 */
const stopEventStatusCron = (intervalId) => {
  if (intervalId) {
    clearInterval(intervalId);
    console.log("🕒 Event Status Cron: Stopped");
  }
};

module.exports = {
  startEventStatusCron,
  stopEventStatusCron,
  updateEventStatuses,
};
