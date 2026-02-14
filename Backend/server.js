const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { connectDB } = require("./config/database");
const authRoutes = require("./routes/authRoutes");
const profileRoutes = require("./routes/profileRoutes");
const postRoutes = require("./routes/postRoutes"); // NEW: Import post routes

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
); // NEW: Post images

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/posts", postRoutes); // NEW: Post routes

// Redirect for old verification links
app.get("/verify-email/:token", (req, res) => {
  const { token } = req.params;
  res.redirect(`/api/auth/verify-email/${token}`);
});

// Basic route
app.get("/", (req, res) => {
  res.json({
    message: "Univibe API is running!",
    version: "1.1.0",
    endpoints: {
      auth: "/api/auth",
      profile: "/api/profile",
      posts: "/api/posts", // NEW
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
  console.log(`   Post Images: http://localhost:${PORT}/uploads/posts/`); // NEW
  console.log(`📱 Post endpoints:`);
  console.log(`   Create: POST http://localhost:${PORT}/api/posts`);
  console.log(`   Get All: GET http://localhost:${PORT}/api/posts`);
  console.log(`   Get by ID: GET http://localhost:${PORT}/api/posts/:id`);
  console.log(`   Like: POST http://localhost:${PORT}/api/posts/:id/like`);
});
