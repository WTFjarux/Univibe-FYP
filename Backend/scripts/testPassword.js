// backend/scripts/testPassword.js

require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/Univibe";

async function testPassword() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("📦 Connected to MongoDB");
    console.log("Database:", mongoose.connection.name);
    console.log("");

    const email = "admin@univibe.com";
    const testPassword = "Admin@123456";

    // Method 1: Find with select
    console.log("=== METHOD 1: User.findOne with select ===");
    const user1 = await User.findOne({ email }).select("+password");
    console.log("User found:", !!user1);
    if (user1) {
      console.log("Password field exists:", !!user1.password);
      console.log("Password type:", typeof user1.password);
      console.log("Password length:", user1.password?.length);
      console.log("Is bcrypt hash:", user1.password?.startsWith("$2"));
      console.log("Password start:", user1.password?.substring(0, 20));

      try {
        const match = await user1.comparePassword(testPassword);
        console.log("comparePassword result:", match);
      } catch (err) {
        console.error("comparePassword error:", err.message);
      }

      // Direct bcrypt test
      try {
        const directMatch = await bcrypt.compare(testPassword, user1.password);
        console.log("Direct bcrypt.compare result:", directMatch);
      } catch (err) {
        console.error("Direct bcrypt error:", err.message);
      }
    }

    console.log("");

    // Method 2: Find with lean
    console.log("=== METHOD 2: User.findOne with lean ===");
    const user2 = await User.findOne({ email }).select("+password").lean();
    console.log("User found:", !!user2);
    if (user2) {
      console.log("Password field exists:", !!user2.password);
      console.log("Password type:", typeof user2.password);

      // lean() returns plain object, no comparePassword method
      try {
        const directMatch = await bcrypt.compare(testPassword, user2.password);
        console.log("Direct bcrypt.compare result:", directMatch);
      } catch (err) {
        console.error("Direct bcrypt error:", err.message);
      }
    }

    console.log("");

    // Method 3: Re-create password hash for comparison
    console.log("=== METHOD 3: Hash comparison test ===");
    const testHash = await bcrypt.hash(testPassword, 12);
    console.log("New hash of 'Admin@123456':", testHash.substring(0, 30));

    if (user1?.password) {
      const matchNewWithStored = await bcrypt.compare(
        testPassword,
        user1.password,
      );
      console.log("New hash matches stored:", matchNewWithStored);

      // Check if the stored hash is valid bcrypt
      try {
        const salt = bcrypt.getSalt(user1.password);
        console.log("Stored hash salt:", salt);
      } catch (err) {
        console.error("Invalid bcrypt hash format:", err.message);
      }
    }

    console.log("");
    console.log("=== SUMMARY ===");

    // Check all users
    const allUsers = await User.find({}).select("+password").lean();
    console.log(`Total users in database: ${allUsers.length}`);
    allUsers.forEach((u, i) => {
      console.log(`User ${i + 1}:`, {
        email: u.email,
        role: u.role,
        hasPassword: !!u.password,
        passwordStart: u.password?.substring(0, 20),
        isEmailVerified: u.isEmailVerified,
      });
    });
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\n📦 Connection closed");
    process.exit(0);
  }
}

testPassword();
