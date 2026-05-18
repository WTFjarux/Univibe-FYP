/**
 * Admin Data Migration Script
 * Moves admin collections from main DB (Univibe) to admin DB (UnivibeAdmin)
 *
 * Usage: node scripts/migrateAdminData.js
 */

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/Univibe";

const collectionsToMigrate = [
  "adminroles",
  "reports",
  "moderationlogs",
  "userwarnings",
  "approvalqueues",
];

async function migrateData() {
  try {
    // Connect to main database
    await mongoose.connect(MONGODB_URI);
    console.log("📦 Connected to main DB:", mongoose.connection.name);

    const mainDb = mongoose.connection.db;

    // Create admin DB connection using the same client
    const adminDb = mongoose.connection.useDb("UnivibeAdmin");
    console.log("📦 Using admin DB: UnivibeAdmin");

    // Ensure admin database is created by writing to it
    await adminDb.createCollection("_migration_check");
    await adminDb.dropCollection("_migration_check");

    let totalMigrated = 0;

    for (const collectionName of collectionsToMigrate) {
      try {
        // Get data from main DB
        const mainCollection = mainDb.collection(collectionName);
        const documents = await mainCollection.find({}).toArray();

        if (!documents || documents.length === 0) {
          console.log(`  ⏭️  ${collectionName}: No data to migrate`);
          continue;
        }

        // Check if data already exists in admin DB
        const adminCollection = adminDb.collection(collectionName);
        const existingCount = await adminCollection.countDocuments();

        if (existingCount > 0) {
          console.log(
            `  ⚠️  ${collectionName}: Already has ${existingCount} documents. Skipping.`,
          );
          continue;
        }

        // Insert into admin DB
        await adminCollection.insertMany(documents);
        console.log(
          `  ✅ ${collectionName}: Migrated ${documents.length} documents`,
        );
        totalMigrated += documents.length;
      } catch (error) {
        // Collection might not exist yet
        console.log(`  ℹ️  ${collectionName}: ${error.message}`);
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total documents migrated: ${totalMigrated}`);

    // Show counts in both databases
    console.log(`\n📋 Data counts after migration:`);
    for (const collectionName of collectionsToMigrate) {
      try {
        const mainCount = await mainDb
          .collection(collectionName)
          .countDocuments();
        const adminCount = await adminDb
          .collection(collectionName)
          .countDocuments();
        console.log(
          `   ${collectionName}: Main=${mainCount}, Admin=${adminCount}`,
        );
      } catch (e) {
        console.log(`   ${collectionName}: Collection doesn't exist`);
      }
    }

    console.log(`\n⚠️  Data COPIED to admin DB. Original still in main DB.`);
    console.log(`   Verify everything works, then clean up main DB.`);

    await mongoose.connection.close();
    console.log(`\n📦 Connection closed`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration error:", error.message);
    process.exit(1);
  }
}

migrateData();
