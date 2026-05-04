// backend/controllers/groupController.js

const ChatRoom = require("../models/ChatRoom");
const User = require("../models/User");
const Profile = require("../models/Profile");
const Message = require("../models/Message");

// -----------------------------------------------------------------------------
// CREATE GROUP
// -----------------------------------------------------------------------------

/**
 * Create a new group chat
 * POST /api/chat/group/create
 * Body: { name, participantIds, icon?, description?, settings? }
 */
exports.createGroup = async (req, res) => {
  try {
    const { name, participantIds, icon, description, settings } = req.body;
    const userId = req.user.id;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Group name is required",
      });
    }

    if (
      !participantIds ||
      !Array.isArray(participantIds) ||
      participantIds.length < 2
    ) {
      return res.status(400).json({
        success: false,
        message: "At least 2 participants are required (excluding yourself)",
      });
    }

    // Remove duplicates and self
    const uniqueParticipants = [...new Set(participantIds)].filter(
      (id) => id.toString() !== userId.toString(),
    );

    if (uniqueParticipants.length < 2) {
      return res.status(400).json({
        success: false,
        message: "At least 2 other participants are required",
      });
    }

    // Verify all participant IDs exist
    const users = await User.find({
      _id: { $in: uniqueParticipants },
    }).select("_id");

    if (users.length !== uniqueParticipants.length) {
      return res.status(400).json({
        success: false,
        message: "One or more participants not found",
      });
    }

    // Create group using the model's static method
    const group = await ChatRoom.createGroup({
      name: name.trim(),
      createdBy: userId,
      participants: uniqueParticipants,
      groupIcon: icon || null,
      groupPhoto: icon || null,
      groupDescription: description || "",
      settings: settings || {},
    });

    // Populate participants for response
    const populatedGroup = await ChatRoom.findById(group._id)
      .populate("participants.userId", "name username avatar")
      .lean();

    // Format response
    const formattedParticipants = populatedGroup.participants.map((p) => ({
      userId: p.userId._id || p.userId,
      name: p.userId.name || "Unknown",
      username: p.userId.username || "",
      avatar: p.userId.avatar || "",
      role: p.role,
      joinedAt: p.joinedAt,
    }));

    // Socket notifications
    const io = req.app.get("io");
    if (io) {
      // Notify each participant individually
      uniqueParticipants.forEach((participantId) => {
        io.to(`user_${participantId}`).emit("added_to_group", {
          roomId: group.roomId,
          groupName: name.trim(),
          addedBy: userId,
          participantCount: group.participants.length,
        });
      });

      // Notify creator
      io.to(`user_${userId}`).emit("group_created", {
        roomId: group.roomId,
        groupName: name.trim(),
        participantCount: group.participants.length,
      });
    }

    res.status(201).json({
      success: true,
      message: "Group created successfully",
      data: {
        roomId: group.roomId,
        type: group.type,
        name: group.name,
        groupIcon: group.groupIcon,
        groupDescription: group.groupDescription,
        participantCount: group.participants.length,
        participants: formattedParticipants,
        groupSettings: group.groupSettings,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
      },
    });
  } catch (error) {
    console.error("createGroup error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// ADD MEMBERS
// -----------------------------------------------------------------------------

/**
 * Add members to a group
 * PUT /api/chat/group/:roomId/add-members
 * Body: { memberIds }
 */
exports.addMembers = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user.id;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one member ID is required",
      });
    }

    const room = await ChatRoom.findOne({ roomId });
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    if (room.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Can only add members to group chats",
      });
    }

    // Check permissions
    if (!room.canAddMembers(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to add members",
      });
    }

    // Verify users exist
    const users = await User.find({ _id: { $in: memberIds } }).select("_id");
    if (users.length !== memberIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more users not found",
      });
    }

    // Add new members (filter out existing)
    const newMembers = memberIds.filter((id) => !room.isParticipant(id));

    if (newMembers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All users are already members",
      });
    }

    // Add members
    newMembers.forEach((memberId) => room.addParticipant(memberId));
    await room.save();

    // Socket notifications
    const io = req.app.get("io");
    if (io) {
      // Notify new members
      newMembers.forEach((memberId) => {
        io.to(`user_${memberId}`).emit("added_to_group", {
          roomId,
          groupName: room.name,
          addedBy: userId,
        });
      });

      // Notify existing members in the room
      io.to(roomId).emit("group_members_added", {
        roomId,
        newMembers,
        addedBy: userId,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: `${newMembers.length} member(s) added`,
      data: {
        roomId,
        addedMembers: newMembers,
        totalParticipants: room.participants.length,
      },
    });
  } catch (error) {
    console.error("addMembers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// REMOVE MEMBER
// -----------------------------------------------------------------------------

/**
 * Remove a member from group
 * PUT /api/chat/group/:roomId/remove-member
 * Body: { memberId }
 */
exports.removeMember = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { memberId } = req.body;
    const userId = req.user.id;

    if (!memberId) {
      return res.status(400).json({
        success: false,
        message: "Member ID is required",
      });
    }

    const room = await ChatRoom.findOne({ roomId });
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    if (room.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Can only remove members from group chats",
      });
    }

    // Check permissions
    const isSelfRemove = memberId.toString() === userId.toString();
    const userRole = room.getParticipantRole(userId);

    if (!isSelfRemove && !["admin", "owner"].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Only admins can remove members",
      });
    }

    // Check if target is a participant
    if (!room.isParticipant(memberId)) {
      return res.status(400).json({
        success: false,
        message: "User is not a member of this group",
      });
    }

    // Owner cannot be removed by others
    const targetRole = room.getParticipantRole(memberId);
    if (targetRole === "owner" && !isSelfRemove) {
      return res.status(403).json({
        success: false,
        message: "Cannot remove the group owner",
      });
    }

    // Remove member
    room.removeParticipant(memberId, userId);
    await room.save();

    // Socket notifications
    const io = req.app.get("io");
    if (io) {
      // Notify removed user
      io.to(`user_${memberId}`).emit("removed_from_group", {
        roomId,
        groupName: room.name,
        removedBy: userId,
      });

      // Notify remaining members
      io.to(roomId).emit("group_member_removed", {
        roomId,
        removedMember: memberId,
        removedBy: userId,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: "Member removed successfully",
      data: { roomId, removedMember: memberId },
    });
  } catch (error) {
    console.error("removeMember error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// LEAVE GROUP
// -----------------------------------------------------------------------------

/**
 * Leave a group chat
 * POST /api/chat/group/:roomId/leave
 */
exports.leaveGroup = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    const room = await ChatRoom.findOne({ roomId });
    if (!room) {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    if (room.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Cannot leave a direct chat",
      });
    }

    if (!room.isParticipant(userId)) {
      return res.status(400).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    const userRole = room.getParticipantRole(userId);

    // If owner is leaving, transfer ownership
    if (userRole === "owner") {
      const newOwner =
        room.participants.find(
          (p) => p.role === "admin" && p.userId.toString() !== userId,
        ) || room.participants.find((p) => p.userId.toString() !== userId);

      if (newOwner) {
        room.transferOwnership(userId, newOwner.userId);
      }
    }

    // Remove the user
    room.removeParticipant(userId, userId);
    await room.save();

    // Socket notification
    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("group_member_left", {
        roomId,
        userId,
        timestamp: new Date(),
      });
    }

    res.json({ success: true, message: "Left group successfully" });
  } catch (error) {
    console.error("leaveGroup error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// UPDATE GROUP INFO
// -----------------------------------------------------------------------------

/**
 * Update group information
 * PUT /api/chat/group/:roomId/update
 * Body: { name?, icon?, description?, settings? }
 */
exports.updateGroup = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { name, icon, description, settings } = req.body;
    const userId = req.user.id;

    const room = await ChatRoom.findOne({ roomId });
    if (!room || room.type !== "group") {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    // Check permissions
    if (!room.canChangeGroupInfo(userId)) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to update group info",
      });
    }

    if (name && name.trim()) room.name = name.trim();
    if (icon !== undefined) {
      room.groupIcon = icon;
      room.groupPhoto = icon; 
    }
    if (description !== undefined) room.groupDescription = description;

    if (settings) {
      if (settings.onlyAdminsCanSend !== undefined) {
        room.groupSettings.onlyAdminsCanSend = settings.onlyAdminsCanSend;
      }
      if (settings.onlyAdminsCanAddMembers !== undefined) {
        room.groupSettings.onlyAdminsCanAddMembers =
          settings.onlyAdminsCanAddMembers;
      }
      if (settings.onlyAdminsCanChangeInfo !== undefined) {
        room.groupSettings.onlyAdminsCanChangeInfo =
          settings.onlyAdminsCanChangeInfo;
      }
    }

    await room.save();

    // Socket notification
    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("group_updated", {
        roomId,
        name: room.name,
        icon: room.groupIcon,
        description: room.groupDescription,
        settings: room.groupSettings,
        updatedBy: userId,
        timestamp: new Date(),
      });
    }

    res.json({
      success: true,
      message: "Group updated successfully",
      data: {
        roomId: room.roomId,
        name: room.name,
        groupIcon: room.groupIcon,
        groupDescription: room.groupDescription,
        groupSettings: room.groupSettings,
      },
    });
  } catch (error) {
    console.error("updateGroup error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// MAKE ADMIN
// -----------------------------------------------------------------------------

/**
 * Promote member to admin
 * PUT /api/chat/group/:roomId/make-admin
 * Body: { memberId }
 */
exports.makeAdmin = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { memberId } = req.body;
    const userId = req.user.id;

    if (!memberId) {
      return res
        .status(400)
        .json({ success: false, message: "Member ID is required" });
    }

    const room = await ChatRoom.findOne({ roomId });
    if (!room || room.type !== "group") {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    // Only owner can make admins
    const userRole = room.getParticipantRole(userId);
    if (userRole !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only the group owner can make admins",
      });
    }

    if (!room.isParticipant(memberId)) {
      return res
        .status(400)
        .json({ success: false, message: "User is not a member" });
    }

    const targetRole = room.getParticipantRole(memberId);
    if (targetRole === "owner") {
      return res
        .status(400)
        .json({ success: false, message: "User is already the owner" });
    }

    room.promoteToAdmin(memberId);
    await room.save();

    // Socket notification
    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("group_role_changed", {
        roomId,
        userId: memberId,
        newRole: "admin",
        changedBy: userId,
      });
    }

    res.json({ success: true, message: "Member promoted to admin" });
  } catch (error) {
    console.error("makeAdmin error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// REMOVE ADMIN
// -----------------------------------------------------------------------------

/**
 * Demote admin to member
 * PUT /api/chat/group/:roomId/remove-admin
 * Body: { memberId }
 */
exports.removeAdmin = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { memberId } = req.body;
    const userId = req.user.id;

    if (!memberId) {
      return res
        .status(400)
        .json({ success: false, message: "Member ID is required" });
    }

    const room = await ChatRoom.findOne({ roomId });
    if (!room || room.type !== "group") {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    // Only owner can remove admins
    const userRole = room.getParticipantRole(userId);
    if (userRole !== "owner") {
      return res.status(403).json({
        success: false,
        message: "Only the group owner can remove admins",
      });
    }

    const targetRole = room.getParticipantRole(memberId);
    if (targetRole !== "admin") {
      return res
        .status(400)
        .json({ success: false, message: "User is not an admin" });
    }

    room.demoteToMember(memberId);
    await room.save();

    // Socket notification
    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("group_role_changed", {
        roomId,
        userId: memberId,
        newRole: "member",
        changedBy: userId,
      });
    }

    res.json({ success: true, message: "Admin demoted to member" });
  } catch (error) {
    console.error("removeAdmin error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// -----------------------------------------------------------------------------
// GET GROUP MEMBERS
// -----------------------------------------------------------------------------

/**
 * Get group members list
 * GET /api/chat/group/:roomId/members
 */
exports.getMembers = async (req, res) => {
  try {
    const { roomId } = req.params;

    const room = await ChatRoom.findOne({ roomId })
      .populate("participants.userId", "name username avatar profilePicture")
      .lean();

    if (!room || room.type !== "group") {
      return res
        .status(404)
        .json({ success: false, message: "Group not found" });
    }

    const members = room.participants.map((p) => ({
      userId: p.userId?._id || p.userId,
      name: p.userId?.name || "Unknown",
      username: p.userId?.username || "",
      avatar: p.userId?.avatar || p.userId?.profilePicture || "",
      role: p.role || "member",
      joinedAt: p.joinedAt,
      lastReadAt: p.lastReadAt,
    }));

    res.json({ success: true, data: members });
  } catch (error) {
    console.error("getMembers error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
