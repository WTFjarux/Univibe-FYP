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

// Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const profileRoutes = require("./routes/profileRoutes");
const postRoutes = require("./routes/postRoutes");
const connectionRoutes = require("./routes/connectionRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const eventRoutes = require("./routes/eventRoutes");
const chatRoutes = require("./routes/chatRoutes");
const feedRoutes = require("./routes/feedRoutes");

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);

// Setup Socket.IO
const io = setupSocketIO(server);
initializeSocketIO(io);

// Make io accessible to routes (optional)
app.set("io", io);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use("/api/users", userRoutes);

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

// CRITICAL FIX: Serve chat audio files
app.use(
  "/uploads/chat/audio",
  express.static(path.join(__dirname, "uploads/chat/audio")),
);

// Also serve any other uploads
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/connections", connectionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/chat", chatRoutes);

// Redirect for old verification links
app.get("/verify-email/:token", (req, res) => {
  const { token } = req.params;
  res.redirect(`/api/auth/verify-email/${token}`);
});

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "Univibe API is running!",
    version: "1.5.0",
    endpoints: {
      auth: "/api/auth",
      profile: "/api/profile",
      posts: "/api/posts",
      connections: "/api/connections",
      notifications: "/api/notifications",
      events: "/api/events",
      chat: "/api/chat",
    },
    websocket: {
      status: "active",
      port: process.env.PORT || 5001,
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

const PORT = process.env.PORT || 5001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📡 Socket.IO running on same port`);
  console.log(`\n📁 Upload directories:`);
  console.log(`   Profile Pictures: /uploads/profile-pictures`);
  console.log(`   Cover Photos: /uploads/cover-photos`);
  console.log(`   Post Images: /uploads/posts`);
  console.log(`   Event Images: /uploads/events`);
  console.log(`   Chat Audio: /uploads/chat/audio`);
  console.log(`\n📱 API Endpoints:`);
  console.log(`   Auth: /api/auth`);
  console.log(`   Profile: /api/profile`);
  console.log(`   Posts: /api/posts`);
  console.log(`   Connections: /api/connections`);
  console.log(`   Notifications: /api/notifications`);
  console.log(`   Events: /api/events`);
  console.log(`   Chat: /api/chat`);
  console.log(`\n💬 Real-time Events Available:`);
  console.log(`   join_room, leave_room`);
  console.log(`   send_message, receive_message`);
  console.log(`   typing, stop_typing`);
  console.log(`   user_online, user_offline`);
  console.log(`   call_user, offer, answer, ice_candidate, end_call`);
});
