require("dotenv").config({ path: "../.env" });
const mongoose = require("mongoose");
const User = require("../models/User");

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/Univibe";

const adminUser = {
  name: "Super Admin",
  email: "admin@univibe.com",
  password: "Admin@123456",
  username: "superadmin",
  role: "admin",
  isEmailVerified: true,
  profileComplete: true,
};

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("📦 Connected to main DB:", mongoose.connection.name);

    const adminDb = mongoose.connection.useDb("UnivibeAdmin");

    // Check if admin user exists in main DB
    let user = await User.findOne({ email: adminUser.email });

    if (!user) {
      user = new User(adminUser);
      await user.save();
      console.log("✅ Admin user created:", user.email);
    } else {
      console.log("⚠️  Admin user already exists:", user.email);
    }

    // Use AdminRole schema on admin DB
    const AdminRoleSchema = require("../models/AdminRole").schema;
    const AdminRole = adminDb.model("AdminRole", AdminRoleSchema);

    const existingRole = await AdminRole.findOne({ user: user._id });

    if (!existingRole) {
      await AdminRole.create({
        user: user._id.toString(),
        role: "super_admin",
        isActive: true,
        notes: "Created by seed script",
      });
      console.log("✅ Admin role created in admin DB: super_admin");
    } else {
      existingRole.role = "super_admin";
      await existingRole.save();
      console.log("✅ Admin role updated to super_admin");
    }

    console.log("\n📋 Admin Credentials:");
    console.log("   Email:", adminUser.email);
    console.log("   Password:", adminUser.password);

    await mongoose.connection.close();
    console.log("\n📦 Connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

seedAdmin();
