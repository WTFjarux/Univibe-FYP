// backend/scripts/migrateApprovalSnapshots.js
// Run: node scripts/migrateApprovalSnapshots.js

const mongoose = require("mongoose");
const Community = require("../models/Community");
const ApprovalQueue = require("../models/ApprovalQueue");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/univibe";

async function migrate() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB");

    const entries = await ApprovalQueue.find({
      contentType: { $in: ["community", "department"] },
    });

    console.log(`Found ${entries.length} approval entries`);

    let updated = 0;
    for (const entry of entries) {
      const community = await Community.findById(entry.contentId);
      if (community) {
        // Update snapshot with tags and rules
        if (!entry.contentSnapshot.tags) {
          entry.contentSnapshot.tags = community.tags || [];
        }
        if (!entry.contentSnapshot.rules) {
          entry.contentSnapshot.rules = community.rules || [];
        }
        if (!entry.contentSnapshot.memberCount) {
          entry.contentSnapshot.memberCount = community.memberCount || 0;
        }
        await entry.save();
        updated++;
        console.log(`Updated: ${community.name}`);
      }
    }

    console.log(`Migration complete. Updated ${updated} entries.`);
  } catch (error) {
    console.error("Migration error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

migrate();
