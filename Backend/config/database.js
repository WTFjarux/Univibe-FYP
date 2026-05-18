const mongoose = require("mongoose");
require("colors");

// ============================================
// MAIN DATABASE CONNECTION (Univibe)
// ============================================
const connectDB = async () => {
  try {
    mongoose.set("strictQuery", true);

    console.log("🔌 Attempting MongoDB connection...");

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 5,
    });

    console.log(`✅ Main DB Connected: ${conn.connection.host}`.green);
    console.log(`📊 Database: ${conn.connection.name}`.cyan);

    // Connect to admin database
    await connectAdminDB();

    // Check registered models
    checkRegisteredModels();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`.red);
    process.exit(1);
  }
};

// ============================================
// ADMIN DATABASE CONNECTION (UnivibeAdmin)
// ============================================
let adminConnection = null;

const connectAdminDB = async () => {
  try {
    // Use same host but different database name
    const baseUri = process.env.MONGODB_URI;
    const adminUri = baseUri.replace(/\/[^/]+$/, "/UnivibeAdmin");

    adminConnection = await mongoose.createConnection(adminUri, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      maxPoolSize: 5,
      minPoolSize: 2,
    });

    console.log(`✅ Admin DB Connected: ${adminConnection.host}`.green);
    console.log(`📊 Admin Database: ${adminConnection.name}`.cyan);

    // Register admin models on this connection
    registerAdminModels(adminConnection);

    return adminConnection;
  } catch (error) {
    console.error(`❌ Admin DB Connection Error: ${error.message}`.red);
    // Don't exit - admin features will be unavailable but main app works
    return null;
  }
};

// ============================================
// REGISTER ADMIN MODELS
// ============================================
const registerAdminModels = (conn) => {
  const modelDefinitions = {
    AdminRole: require("../models/AdminRole"),
    Report: require("../models/Report"),
    ModerationLog: require("../models/ModerationLog"),
    UserWarning: require("../models/UserWarning"),
    ApprovalQueue: require("../models/ApprovalQueue"),
  };

  Object.entries(modelDefinitions).forEach(([name, schema]) => {
    // Only register if not already registered on this connection
    if (!conn.models[name]) {
      conn.model(name, schema.schema || schema);
    }
  });

  console.log(`📦 Admin models registered on admin connection`.cyan);
};

// ============================================
// GET ADMIN CONNECTION
// ============================================
const getAdminConnection = () => {
  if (!adminConnection) {
    throw new Error("Admin database not connected");
  }
  return adminConnection;
};

// ============================================
// GET ADMIN MODEL
// ============================================
const getAdminModel = (modelName) => {
  const conn = getAdminConnection();
  return conn.model(modelName);
};

// ============================================
// CHECK REGISTERED MODELS
// ============================================
function checkRegisteredModels() {
  const models = mongoose.models;
  const modelNames = Object.keys(models);

  console.log("\n📦 Registered Models (Main DB):");
  console.log("─".repeat(50));

  if (modelNames.length === 0) {
    console.log("⚠️  No models registered yet.".yellow);
  } else {
    modelNames.forEach((modelName, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${modelName}`);
    });
  }

  if (adminConnection) {
    const adminModels = Object.keys(adminConnection.models);
    console.log("\n📦 Registered Models (Admin DB):");
    console.log("─".repeat(50));
    adminModels.forEach((modelName, index) => {
      console.log(`  ${(index + 1).toString().padStart(2)}. ${modelName}`);
    });
  }

  console.log("─".repeat(50));
}

// ============================================
// EVENT HANDLERS
// ============================================
mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected (main DB)".green);
});

mongoose.connection.on("error", (err) => {
  console.error(`❌ Mongoose connection error: ${err}`.red);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️  Mongoose disconnected (main DB)".yellow);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  if (adminConnection) await adminConnection.close();
  console.log("🔌 MongoDB connections closed".yellow);
  process.exit(0);
});

module.exports = {
  connectDB,
  getAdminConnection,
  getAdminModel,
  connection: mongoose.connection,
};
