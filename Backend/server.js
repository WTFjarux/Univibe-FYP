const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { connectDB } = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const postRoutes = require("./routes/postRoutes");
const connectionRoutes = require("./routes/connectionRoutes"); // ADDED: Connection routes

// Connect to database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Serve uploaded files statically
app.use(
  "/uploads/profile-pictures",
  express.static(path.join(__dirname, "uploads/profile-pictures")),
);
app.use(
  "/uploads/cover-photos",
  express.static(path.join(__dirname, "uploads/cover-photos")),
);
app.use(
  "/uploads/posts",
  express.static(path.join(__dirname, "uploads/posts")),
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/connections", connectionRoutes); // ADDED: Connection routes at root level

// Redirect for old verification links
app.get("/verify-email/:token", (req, res) => {
  const { token } = req.params;
  res.redirect(`/api/auth/verify-email/${token}`);
});

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "Univibe API is running!",
    version: "1.2.0", // Updated version
    endpoints: {
      auth: "/api/auth",
      profile: "/api/profile",
      posts: "/api/posts",
      connections: "/api/connections", // ADDED
    },
  });
});

// Handle undefined routes
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("Server Error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📁 Uploads available at:`);
  console.log(
    `   Profile Pictures: http://localhost:${PORT}/uploads/profile-pictures/`,
  );
  console.log(
    `   Cover Photos: http://localhost:${PORT}/uploads/cover-photos/`,
  );
  console.log(`   Post Images: http://localhost:${PORT}/uploads/posts/`);
  console.log(`\n📱 API Endpoints:`);
  console.log(`   Auth: http://localhost:${PORT}/api/auth`);
  console.log(`   Profile: http://localhost:${PORT}/api/profile`);
  console.log(`   Posts: http://localhost:${PORT}/api/posts`);
  console.log(`   Connections: http://localhost:${PORT}/api/connections`);
  console.log(`\n🔗 Connection Endpoints:`);
  console.log(`   Send Request: POST /api/connections/request/:userId`);
  console.log(`   Accept Request: POST /api/connections/accept/:requestId`);
  console.log(`   Reject Request: POST /api/connections/reject/:requestId`);
  console.log(`   Remove Connection: DELETE /api/connections/remove/:connectionId`);
  console.log(`   Get Connections: GET /api/connections/:userId/connections`);
  console.log(`   Get Pending: GET /api/connections/requests/pending`);
  console.log(`   Check Status: GET /api/connections/status/:userId`);
  console.log(`   Get Mutual: GET /api/connections/mutual/:userId`);
  console.log(`   Get Suggestions: GET /api/connections/suggestions`);
  console.log(`\n📝 Post Endpoints:`);
  console.log(`   Create: POST /api/posts`);
  console.log(`   Get All: GET /api/posts`);
  console.log(`   Get by ID: GET /api/posts/:id`);
  console.log(`   Update: PUT /api/posts/:id`);
  console.log(`   Delete: DELETE /api/posts/:id`);
  console.log(`   Like: POST /api/posts/:id/like`);
  console.log(`   Search: GET /api/posts/search`);
  console.log(`\n👤 Profile Endpoints:`);
  console.log(`   Get My Profile: GET /api/profile/my-profile`);
  console.log(`   Update Profile: PUT /api/profile/update`);
  console.log(`   Get Public Profile: GET /api/profile/public/:userId`);
  console.log(`   Search Profiles: GET /api/profile/search`);
});