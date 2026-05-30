const mongoose = require("mongoose");
require("colors");

// ============================================
// MAIN DATABASE CONNECTION (Univibe)
// ============================================
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

const connectDB = async () => {
  if (isConnecting) {
    console.log("⏳ Connection already in progress, skipping...".yellow);
    return;
  }

  try {
    isConnecting = true;
    mongoose.set("strictQuery", true);

    console.log("🔌 Attempting MongoDB connection...");

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 0,
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 5000,
      family: 4,
      maxPoolSize: 10,
      minPoolSize: 2,
      maxIdleTimeMS: 60000,
      waitQueueTimeoutMS: 30000,
    });

    console.log(`✅ Main DB Connected: ${conn.connection.host}`.green);
    console.log(`📊 Database: ${conn.connection.name}`.cyan);

    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    isConnecting = false;

    // Connect to admin database
    await connectAdminDB();

    // Check registered models
    checkRegisteredModels();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`.red);
    isConnecting = false;

    // Retry with exponential backoff instead of exiting
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(
        `🔄 Retrying connection in ${delay / 1000}s (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`
          .yellow,
      );
      setTimeout(connectDB, delay);
    } else {
      console.error(
        `❌ Max reconnection attempts reached. Please check MongoDB service.`
          .red,
      );
      process.exit(1);
    }
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
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 0, // No timeout for admin connection too
      connectTimeoutMS: 30000,
      heartbeatFrequencyMS: 5000,
      family: 4,
      maxPoolSize: 5,
      minPoolSize: 1,
      maxIdleTimeMS: 60000,
    });

    console.log(`✅ Admin DB Connected`.green);
    console.log(
      `📊 Admin Database: ${adminConnection.name || "UnivibeAdmin"}`.cyan,
    );

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
// IMPROVED EVENT HANDLERS
// ============================================
let isManualReconnect = false;

mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected (main DB)".green);
  isManualReconnect = false;
  reconnectAttempts = 0;
});

mongoose.connection.on("error", (err) => {
  // Don't log stack trace for network errors
  if (
    err.message?.includes("PoolClearedOnNetworkError") ||
    err.message?.includes("topology was destroyed")
  ) {
    console.log(
      "⚠️ Mongoose connection pool issue, attempting to recover...".yellow,
    );
  } else if (!err.message?.includes("keepalive")) {
    // Don't log the keepalive error since we removed it
    console.error(`❌ Mongoose connection error: ${err.message}`.red);
  }
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ Mongoose disconnected (main DB)".yellow);

  // Auto-reconnect if not already trying
  if (
    !isManualReconnect &&
    !isConnecting &&
    mongoose.connection.readyState !== 1
  ) {
    isManualReconnect = true;
    console.log("🔄 Auto-reconnecting to MongoDB...".cyan);
    setTimeout(() => {
      connectDB().catch(console.error);
      isManualReconnect = false;
    }, 3000);
  }
});

// Periodic health check to keep connection alive
let healthCheckInterval = setInterval(async () => {
  if (mongoose.connection.readyState === 1) {
    try {
      // Ping the database to keep connection alive
      await mongoose.connection.db.admin().ping();
    } catch (error) {
      console.log("⚠️ Health check failed, connection may be dead".yellow);
    }
  }
}, 25000); // Check every 25 seconds

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🔌 Shutting down...".yellow);
  clearInterval(healthCheckInterval);
  await mongoose.connection.close();
  if (adminConnection) await adminConnection.close();
  console.log("✅ MongoDB connections closed".green);
  process.exit(0);
});

module.exports = {
  connectDB,
  getAdminConnection,
  getAdminModel,
  connection: mongoose.connection,
};
