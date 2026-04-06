const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { connectDB } = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const postRoutes = require("./routes/postRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const eventRoutes = require("./routes/eventRoutes"); // NEW: Import event routes

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
app.use(
  "/uploads/events",
  express.static(path.join(__dirname, "uploads/events")),
); // NEW: Serve event images

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/events", eventRoutes); // NEW: Mount event routes

// Redirect for old verification links
app.get("/verify-email/:token", (req, res) => {
  const { token } = req.params;
  res.redirect(`/api/auth/verify-email/${token}`);
});

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "Univibe API is running!",
    version: "1.4.0", // Updated version
    endpoints: {
      auth: "/api/auth",
      profile: "/api/profile",
      posts: "/api/posts",
      connections: "/api/connections",
      notifications: "/api/notifications",
      events: "/api/events", // NEW: Added events endpoint
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
  console.error("Server Error:", error.message);
  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`\n📁 Upload directories:`);
  console.log(`   Profile Pictures: /uploads/profile-pictures`);
  console.log(`   Cover Photos: /uploads/cover-photos`);
  console.log(`   Post Images: /uploads/posts`);
  console.log(`   Event Images: /uploads/events`); // NEW
  console.log(`\n📱 API Endpoints:`);
  console.log(`   Auth: /api/auth`);
  console.log(`   Profile: /api/profile`);
  console.log(`   Posts: /api/posts`);
  console.log(`   Connections: /api/connections`);
  console.log(`   Notifications: /api/notifications`);
  console.log(`   Events: /api/events`); // NEW
  console.log(`\n🎉 Event Endpoints:`);
  console.log(`   Create: POST /api/events`);
  console.log(`   Get All: GET /api/events`);
  console.log(`   Get One: GET /api/events/:eventId`);
  console.log(`   My Events: GET /api/events/my-events`);
  console.log(`   Attending: GET /api/events/attending`);
  console.log(`   Interested: POST /api/events/:eventId/interested`);
  console.log(`   RSVP: POST /api/events/:eventId/rsvp`);
});
