/**
 * server.js — Main Application Entry Point
 *
 * Integrates Express REST API with Socket.IO real-time features
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
require("dotenv").config();

const { connectDB } = require("./config/database");
const { setupSocketIO } = require("./config/socket");
const { initializeSocketIO } = require("./socket");
const { startCleanupJob } = require("./jobs/cleanupPosts");
const { startEventStatusCron } = require("./jobs/eventStatusCron");

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const profileRoutes = require("./routes/profileRoutes");
const postRoutes = require("./routes/postRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const eventRoutes = require("./routes/eventRoutes");
const chatRoutes = require("./routes/chatRoutes");
const groupRoutes = require("./routes/groupRoutes");
const feedRoutes = require("./routes/feedRoutes");
const storyRoutes = require("./routes/storyRoutes");
const contentRoutes = require("./routes/contentRoutes");
const searchRoutes = require("./routes/searchRoutes");
// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// Setup Socket.IO
const io = setupSocketIO(server);
initializeSocketIO(io);

// Make io accessible to routes
app.set("io", io);

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
);
app.use(
  "/uploads/chat/audio",
  express.static(path.join(__dirname, "uploads/chat/audio")),
);
app.use(
  "/uploads/chat/attachments",
  express.static(path.join(__dirname, "uploads/chat/attachments")),
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =============================================================================
// API ROUTES
// =============================================================================

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/stories", storyRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/search", searchRoutes);
app.use(
  "/uploads/group-photos",
  express.static(path.join(__dirname, "uploads/group-photos")),
);

// Redirect for old verification links
app.get("/verify-email/:token", (req, res) => {
  const { token } = req.params;
  res.redirect(`/api/auth/verify-email/${token}`);
});

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "Univibe API is running!",
    version: "1.6.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
      profile: "/api/profile",
      posts: "/api/posts",
      feed: "/api/feed",
      content: "/api/content",
      connections: "/api/connections",
      notifications: "/api/notifications",
      events: "/api/events",
      chat: "/api/chat",
      groups: "/api/groups",
      search: "/api/search",
    },
    websocket: {
      status: "active",
      port: process.env.PORT || 5001,
    },
    cleanup: {
      status: "active",
      schedule: "Daily at 2:00 AM",
      deleteAfterDays: 30,
    },
    eventStatusCron: {
      status: "active",
      schedule: "Every 60 seconds",
      description:
        "Automatically updates event statuses (upcoming → ongoing → completed)",
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

  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  if (error.name === "ValidationError") {
    const messages = Object.values(error.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: messages,
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// =============================================================================
// START SERVER
// =============================================================================

const PORT = process.env.PORT || 5001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📡 Socket.IO running on same port`);

  // Start the cleanup job (deletes old posts after 30 days)
  startCleanupJob();

  // Start the event status cron job (updates event statuses every 60 seconds)
  startEventStatusCron(60000); // 60,000 ms = 1 minute

  console.log(`\n📁 Upload Directories:`);
  console.log(`   Profile Pictures:  /uploads/profile-pictures`);
  console.log(`   Cover Photos:      /uploads/cover-photos`);
  console.log(`   Post Images:       /uploads/posts`);
  console.log(`   Event Images:      /uploads/events`);
  console.log(`   Chat Audio:        /uploads/chat/audio`);
  console.log(`   Chat Attachments:  /uploads/chat/attachments`);
  console.log(`   Group Photos:      /uploads/group-photos`);

  console.log(`\n📱 API Endpoints:`);
  console.log(`   Auth:           /api/auth`);
  console.log(`   Users:          /api/users`);
  console.log(`   Profile:        /api/profile`);
  console.log(`   Posts:          /api/posts`);
  console.log(`   Feed:           /api/feed`);
  console.log(`   Content:        /api/content`);
  console.log(`   Connections:    /api/connections`);
  console.log(`   Notifications:  /api/notifications`);
  console.log(`   Events:         /api/events`);
  console.log(`   Chat:           /api/chat`);
  console.log(`   Groups:         /api/groups`);

  console.log(`\n💬 Socket.IO Events:`);
  console.log(
    `   Chat:     join_room, leave_room, send_message, receive_message`,
  );
  console.log(`   Typing:   typing, stop_typing`);
  console.log(`   Presence: user_online, user_offline`);
  console.log(
    `   Groups:   create_group, add_group_members, remove_group_member`,
  );
  console.log(`   Calls:    call_user, offer, answer, ice_candidate, end_call`);
  console.log(
    `   Events:   event:updated (real-time event status/RSVP updates)`,
  );

  console.log(`\n✅ Content Management Features:`);
  console.log(`   📌 Saved Posts:    POST /api/content/save/:postId`);
  console.log(`   📌 Saved List:     GET  /api/content/saved`);
  console.log(`   🙈 Hide Post:      POST /api/content/hide/:postId`);
  console.log(`   👁️ Unhide Post:    POST /api/content/unhide/:postId`);
  console.log(`   🙈 Hidden List:    GET  /api/content/hidden`);
  console.log(`   🔇 Mute User:      POST /api/content/mute/:userId`);
  console.log(`   🔇 Muted List:     GET  /api/content/muted`);
  console.log(`   🚫 Block User:     POST /api/content/block/:userId`);
  console.log(`   🚫 Blocked List:   GET  /api/content/blocked`);

  console.log(`\n🧹 Cleanup Job:`);
  console.log(`   Status:         Active`);
  console.log(`   Schedule:       Daily at 2:00 AM`);
  console.log(`   Delete After:   30 days`);

  console.log(`\n📅 Event Status Cron Job:`);
  console.log(`   Status:         Active`);
  console.log(`   Schedule:       Every 60 seconds`);
  console.log(`   Description:    Auto-updates event statuses`);
  console.log(`   Transitions:    upcoming → ongoing → completed`);
  console.log(`   Events API:     PUT /api/events/:eventId/refresh-status`);

  console.log(`\n`);
});

module.exports = app;
