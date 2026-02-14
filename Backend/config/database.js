const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Remove deprecation warnings
    mongoose.set("strictQuery", true);

    console.log("🔌 Attempting MongoDB connection...");

    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10, // Maintain up to 10 socket connections
      minPoolSize: 5, // Maintain at least 5 socket connections
    });

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`.green);
    console.log(`📊 Database: ${conn.connection.name}`.cyan);

    // Check and log all registered models
    checkRegisteredModels();
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`.red);

    // Provide helpful debugging information
    if (error.name === "MongoServerSelectionError") {
      console.error("💡 Troubleshooting tips:".yellow);
      console.error("1. Check if MongoDB is running:".yellow);
      console.error(
        "   - On macOS/Linux: Run `sudo systemctl status mongod` or `brew services list`"
          .yellow,
      );
      console.error(
        "   - On Windows: Check MongoDB service in Services".yellow,
      );
      console.error("2. Verify your MONGODB_URI in .env file".yellow);
      console.error("3. Check if MongoDB port (27017) is accessible".yellow);
      console.error(
        `4. Your current MONGODB_URI: ${process.env.MONGODB_URI ? "✓ Set" : "✗ Not set"}`
          .yellow,
      );
    }

    process.exit(1);
  }
};

// Function to check all registered models
function checkRegisteredModels() {
  const models = mongoose.models;
  const modelNames = Object.keys(models);

  console.log("\n📦 Registered Mongoose Models:");
  console.log("─".repeat(50));

  if (modelNames.length === 0) {
    console.log(
      "⚠️  No models registered yet. Make sure to require your models.".yellow,
    );
  } else {
    modelNames.forEach((modelName, index) => {
      const status = "✓".green;
      console.log(
        `${status} ${(index + 1).toString().padStart(2, " ")}. ${modelName.padEnd(20)}`,
      );

      // Log schema details for key models
      if (modelName === "Post") {
        const postSchema = models[modelName].schema;
        const postFields = Object.keys(postSchema.paths);
        console.log(`   Fields: ${postFields.length} fields`);

        // Show important fields
        const importantFields = [
          "content",
          "user",
          "images",
          "likes",
          "comments",
          "campus",
          "category",
        ];
        console.log(
          `   Includes: ${importantFields.filter((field) => postFields.includes(field)).join(", ")}`,
        );
      }

      if (modelName === "User") {
        const userSchema = models[modelName].schema;
        const userFields = Object.keys(userSchema.paths);
        console.log(`   Fields: ${userFields.length} fields`);
      }
    });
  }
  console.log("─".repeat(50));
}

// Connection event handlers
mongoose.connection.on("connected", () => {
  console.log("✅ Mongoose connected to database".green);
});

mongoose.connection.on("error", (err) => {
  console.error(`❌ Mongoose connection error: ${err}`.red);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️  Mongoose disconnected from database".yellow);
});

mongoose.connection.on("reconnected", () => {
  console.log("🔄 Mongoose reconnected to database".cyan);
});

mongoose.connection.on("reconnectFailed", () => {
  console.error("❌ Mongoose reconnect failed".red);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("🔌 MongoDB connection closed due to app termination".yellow);
  process.exit(0);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (error) => {
  console.error("⚠️  Unhandled Promise Rejection:".yellow, error);
  // In production, you might want to exit the process
  // process.exit(1);
});

// Export connection checker utility
const checkConnection = async () => {
  try {
    const state = mongoose.connection.readyState;
    const states = {
      0: "disconnected",
      1: "connected",
      2: "connecting",
      3: "disconnecting",
    };

    return {
      status: state === 1 ? "connected" : "disconnected",
      state: states[state] || "unknown",
      readyState: state,
      host: mongoose.connection.host,
      database: mongoose.connection.name,
      models: Object.keys(mongoose.models).length,
      collections:
        (await mongoose.connection.db?.listCollections().toArray())?.length ||
        0,
    };
  } catch (error) {
    return {
      status: "error",
      error: error.message,
    };
  }
};

// Export database utilities
module.exports = {
  connectDB,
  checkConnection,
  connection: mongoose.connection,

  // Helper function to check if specific collections exist
  checkCollections: async () => {
    try {
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();
      const collectionNames = collections.map((col) => col.name);

      const requiredCollections = ["users", "posts"];
      const missingCollections = requiredCollections.filter(
        (col) => !collectionNames.includes(col),
      );

      return {
        exists: missingCollections.length === 0,
        collections: collectionNames,
        missing: missingCollections,
        total: collectionNames.length,
      };
    } catch (error) {
      return { error: error.message };
    }
  },

  // Helper function to get collection stats
  getCollectionStats: async () => {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();

      const stats = {};
      for (const collection of collections) {
        const col = db.collection(collection.name);
        const count = await col.countDocuments();
        stats[collection.name] = {
          count,
          size: await col.stats().then((s) => s.size),
          indexes: await col.indexes().then((indexes) => indexes.length),
        };
      }

      return stats;
    } catch (error) {
      return { error: error.message };
    }
  },

  // Function to initialize database with required collections
  initializeDatabase: async () => {
    console.log("🔧 Initializing database...");

    try {
      // Check if collections exist
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();
      const collectionNames = collections.map((col) => col.name);

      console.log("📁 Existing collections:", collectionNames);

      // Create indexes for better performance
      if (mongoose.models.User) {
        await mongoose.models.User.createIndexes();
        console.log("✅ User indexes created");
      }

      if (mongoose.models.Post) {
        await mongoose.models.Post.createIndexes();
        console.log("✅ Post indexes created");

        // Log post indexes for debugging
        const postIndexes = await mongoose.connection.db
          .collection("posts")
          .indexes();
        console.log(
          "📊 Post indexes:",
          postIndexes.map((idx) => idx.name),
        );
      }

      return { success: true, collections: collectionNames };
    } catch (error) {
      console.error("❌ Database initialization error:", error);
      return { success: false, error: error.message };
    }
  },
};
