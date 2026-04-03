// Backend/controllers/connectionController.js
const User = require("../models/User");
const Profile = require("../models/Profile");
const Notification = require("../models/Notification");

// ============================================
// NOTIFICATION HELPER
// ============================================

/**
 * Create a notification for connection events
 */
const createConnectionNotification = async (
  recipientId,
  senderId,
  type,
  title,
  message,
) => {
  try {
    const notification = new Notification({
      recipient: recipientId,
      sender: senderId,
      type,
      title,
      message,
      targetId: null,
      targetModel: null,
    });
    await notification.save();
    return notification;
  } catch (error) {
    console.error("Create notification error:", error);
    return null;
  }
};

// ============================================
// CONNECTION REQUEST MANAGEMENT
// ============================================

/**
 * Send a connection request to another user
 */
exports.sendConnectionRequest = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { userId: receiverId } = req.params;

    if (senderId.toString() === receiverId) {
      return res.status(400).json({
        success: false,
        message: "You cannot send a connection request to yourself",
      });
    }

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (sender.connections.includes(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Already connected with this user",
      });
    }

    if (sender.connectionRequestsSent.includes(receiverId)) {
      return res.status(400).json({
        success: false,
        message: "Connection request already sent",
      });
    }

    // Auto-accept if they already sent a request to us
    if (sender.connectionRequestsReceived.includes(receiverId)) {
      // Add to connections for both users
      sender.connections.push(receiverId);
      sender.connectionRequestsReceived =
        sender.connectionRequestsReceived.filter(
          (id) => id.toString() !== receiverId.toString(),
        );
      sender.connectionCount = sender.connections.length;
      await sender.save();

      receiver.connections.push(senderId);
      receiver.connectionRequestsSent = receiver.connectionRequestsSent.filter(
        (id) => id.toString() !== senderId.toString(),
      );
      receiver.connectionCount = receiver.connections.length;
      await receiver.save();

      // Create notification for auto-accept
      await createConnectionNotification(
        receiverId,
        senderId,
        "connection_accepted",
        "Connection Accepted",
        `${sender.name} accepted your connection request`,
      );

      return res.status(200).json({
        success: true,
        message: "Connected!",
        autoAccepted: true,
        status: "connected",
        data: {
          userConnectionCount: sender.connectionCount,
          targetConnectionCount: receiver.connectionCount,
        },
      });
    }

    // Send new request
    sender.connectionRequestsSent.push(receiverId);
    await sender.save();

    receiver.connectionRequestsReceived.push(senderId);
    await receiver.save();

    // Create notification for the receiver
    await createConnectionNotification(
      receiverId,
      senderId,
      "connection_request",
      "Connection Request",
      `${sender.name} wants to connect with you`,
    );

    res.status(200).json({
      success: true,
      message: "Connection request sent",
      status: "pending_sent",
      data: {
        userConnectionCount: sender.connectionCount,
      },
    });
  } catch (error) {
    console.error("Send request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send request",
    });
  }
};

/**
 * Accept a connection request
 */
exports.acceptConnectionRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { requestId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const requester = await User.findById(requestId);
    if (!requester) {
      return res.status(404).json({
        success: false,
        message: "Requester not found",
      });
    }

    // Check if request exists
    if (!user.connectionRequestsReceived.includes(requestId)) {
      return res.status(400).json({
        success: false,
        message: "No connection request from this user",
      });
    }

    // Accept the connection
    await user.acceptConnectionRequest(requestId);

    // Create notification for the requester
    await createConnectionNotification(
      requestId,
      userId,
      "connection_accepted",
      "Connection Accepted",
      `${user.name} accepted your connection request`,
    );

    // Get updated counts
    const updatedUser = await User.findById(userId).select("connectionCount");
    const updatedRequester =
      await User.findById(requestId).select("connectionCount");

    res.status(200).json({
      success: true,
      message: "Connected!",
      data: {
        userConnectionCount: updatedUser?.connectionCount || 0,
        requesterConnectionCount: updatedRequester?.connectionCount || 0,
      },
    });
  } catch (error) {
    console.error("Accept request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to accept request",
    });
  }
};

/**
 * Reject a connection request
 */
exports.rejectConnectionRequest = async (req, res) => {
  try {
    const userId = req.user._id;
    const { requestId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    await user.rejectConnectionRequest(requestId);

    res.status(200).json({
      success: true,
      message: "Request rejected",
    });
  } catch (error) {
    console.error("Reject request error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject request",
    });
  }
};

/**
 * Remove an existing connection
 */
exports.removeConnection = async (req, res) => {
  try {
    const userId = req.user._id;
    const { connectionId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if connected
    if (!user.connections.includes(connectionId)) {
      return res.status(400).json({
        success: false,
        message: "Not connected with this user",
      });
    }

    await user.removeConnection(connectionId);

    // Get updated counts
    const updatedUser = await User.findById(userId).select("connectionCount");
    const updatedConnection =
      await User.findById(connectionId).select("connectionCount");

    res.status(200).json({
      success: true,
      message: "Connection removed",
      data: {
        userConnectionCount: updatedUser?.connectionCount || 0,
        removedUserConnectionCount: updatedConnection?.connectionCount || 0,
      },
    });
  } catch (error) {
    console.error("Remove connection error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove connection",
    });
  }
};

// ============================================
// CONNECTION DATA RETRIEVAL
// ============================================

/**
 * Get connection status between current user and another user
 */
exports.getConnectionStatus = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const status = currentUser.getConnectionStatus(userId);

    res.status(200).json({
      success: true,
      data: { status },
    });
  } catch (error) {
    console.error("Connection status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check status",
    });
  }
};

/**
 * Get user's connections list with profile pictures
 */
exports.getConnections = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId)
      .populate("connections", "name username email isEmailVerified")
      .select("connections connectionCount");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const paginatedConnections = user.connections.slice(skip, skip + limit);
    const connectionIds = paginatedConnections.map((conn) => conn._id);

    // Get profile pictures
    const profiles = await Profile.find({ user: { $in: connectionIds } })
      .select("user profilePicture fullName")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = {
        profilePicture: profile.profilePicture,
        fullName: profile.fullName,
      };
    });

    const connectionsWithDetails = paginatedConnections.map((connection) => {
      const connectionObj = connection.toObject();
      const profileData = profileMap[connectionObj._id.toString()];

      return {
        ...connectionObj,
        fullName: profileData?.fullName || connectionObj.name,
        profilePicture: profileData?.profilePicture || null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        connections: connectionsWithDetails,
        connectionCount: user.connectionCount,
        pagination: {
          page,
          limit,
          total: user.connectionCount,
          pages: Math.ceil(user.connectionCount / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get connections error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get connections",
    });
  }
};

/**
 * Get pending connection requests
 */
exports.getPendingRequests = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const user = await User.findById(userId)
      .populate(
        "connectionRequestsReceived",
        "name username email isEmailVerified",
      )
      .select("connectionRequestsReceived");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const paginatedRequests = user.connectionRequestsReceived.slice(
      skip,
      skip + limit,
    );
    const requesterIds = paginatedRequests.map((req) => req._id);

    // Get profile pictures
    const profiles = await Profile.find({ user: { $in: requesterIds } })
      .select("user profilePicture fullName")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = {
        profilePicture: profile.profilePicture,
        fullName: profile.fullName,
      };
    });

    const requestsWithDetails = paginatedRequests.map((request) => {
      const requestObj = request.toObject();
      const profileData = profileMap[requestObj._id.toString()];

      return {
        ...requestObj,
        fullName: profileData?.fullName || requestObj.name,
        profilePicture: profileData?.profilePicture || null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        requests: requestsWithDetails,
        total: user.connectionRequestsReceived.length,
        pagination: {
          page,
          limit,
          total: user.connectionRequestsReceived.length,
          pages: Math.ceil(user.connectionRequestsReceived.length / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get pending requests error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get pending requests",
    });
  }
};

/**
 * Get connection count for a user
 */
exports.getConnectionCount = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select("connectionCount");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        connectionCount: user.connectionCount,
      },
    });
  } catch (error) {
    console.error("Get connection count error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get connection count",
    });
  }
};

/**
 * Get mutual connections between current user and another user
 */
exports.getMutualConnections = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const mutualConnectionIds = await currentUser.getMutualConnections(userId);
    const paginatedIds = mutualConnectionIds.slice(skip, skip + limit);

    // Get user details
    const mutualConnections = await User.find({ _id: { $in: paginatedIds } })
      .select("name username email")
      .lean();

    // Get profile pictures
    const profiles = await Profile.find({ user: { $in: paginatedIds } })
      .select("user profilePicture fullName")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = {
        profilePicture: profile.profilePicture,
        fullName: profile.fullName,
      };
    });

    const connectionsWithDetails = mutualConnections.map((connection) => {
      const profileData = profileMap[connection._id.toString()];
      return {
        ...connection,
        fullName: profileData?.fullName || connection.name,
        profilePicture: profileData?.profilePicture || null,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        connections: connectionsWithDetails,
        count: connectionsWithDetails.length,
        total: mutualConnectionIds.length,
        pagination: {
          page,
          limit,
          total: mutualConnectionIds.length,
          pages: Math.ceil(mutualConnectionIds.length / limit),
        },
      },
    });
  } catch (error) {
    console.error("Get mutual connections error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get mutual connections",
    });
  }
};

/**
 * Get connection suggestions based on mutual connections
 */
exports.getConnectionSuggestions = async (req, res) => {
  try {
    const userId = req.user._id;
    const limit = parseInt(req.query.limit) || 10;

    const suggestions = await User.getConnectionSuggestions(userId, limit);
    const suggestionIds = suggestions.map((s) => s._id);

    // Get profile pictures
    const profiles = await Profile.find({ user: { $in: suggestionIds } })
      .select("user profilePicture fullName bio major year")
      .lean();

    const profileMap = {};
    profiles.forEach((profile) => {
      profileMap[profile.user.toString()] = {
        profilePicture: profile.profilePicture,
        fullName: profile.fullName,
        bio: profile.bio,
        major: profile.major,
        year: profile.year,
      };
    });

    const suggestionsWithDetails = suggestions.map((suggestion) => {
      const profileData = profileMap[suggestion._id.toString()];
      return {
        ...suggestion,
        fullName: profileData?.fullName || suggestion.name,
        profilePicture: profileData?.profilePicture || null,
        bio: profileData?.bio || "",
        major: profileData?.major || "",
        year: profileData?.year || "",
        mutualCount: suggestion.mutualCount || 0,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        suggestions: suggestionsWithDetails,
        count: suggestionsWithDetails.length,
      },
    });
  } catch (error) {
    console.error("Get suggestions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get suggestions",
    });
  }
};
