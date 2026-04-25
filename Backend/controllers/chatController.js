// backend/controllers/chatController.js

const Message = require("../models/Message");
const User = require("../models/User");
const Profile = require("../models/Profile");
const ChatRoom = require("../models/ChatRoom");
const fs = require("fs");
const mongoose = require("mongoose");

// ── HELPERS ──────────────────────────────────────────────────

const getDirectRoomId = (id1, id2) => {
  const ids = [id1.toString(), id2.toString()].sort();
  return `direct_${ids[0]}_${ids[1]}`;
};

const formatMessage = (msg, currentUserId) => ({
  _id: msg._id,
  sender: msg.sender?._id || msg.sender,
  senderName: msg.senderName,
  senderAvatar: msg.sender?.avatar || msg.senderAvatar,
  roomId: msg.roomId,
  message: msg.message,
  type: msg.type,
  createdAt: msg.createdAt,
  status: msg.status,
  mediaUrl: msg.mediaUrl,
  mediaName: msg.mediaName,
  mediaSize: msg.mediaSize,
  duration: msg.duration,
  thumbnailUrl: msg.thumbnailUrl,
  locationData: msg.locationData,
  replyTo: msg.replyTo?.messageId
    ? {
        messageId: msg.replyTo.messageId,
        message: msg.replyTo.message,
        senderName: msg.replyTo.senderName,
        senderId: msg.replyTo.senderId,
        type: msg.replyTo.type || "text",
        mediaUrl: msg.replyTo.mediaUrl,
        duration: msg.replyTo.duration,
      }
    : null,
  reactions: (msg.reactions || []).map((r) => ({
    userId: r.user?._id || r.user,
    reaction: r.reaction,
    createdAt: r.createdAt,
    userName: r.user?.name,
  })),
  readBy: (msg.readBy || []).map((r) => r.user?._id || r.user),
});

// ── ROOM CONTROLLERS ─────────────────────────────────────────

exports.getOrCreateDirectRoom = async (req, res) => {
  try {
    const roomId = getDirectRoomId(req.user.id, req.params.otherUserId);
    let room = await ChatRoom.findOne({ roomId });
    if (!room) {
      room = await ChatRoom.create({
        roomId,
        type: "direct",
        participants: [
          {
            userId: req.user.id,
            joinedAt: new Date(),
            role: "member",
            lastReadAt: new Date(),
          },
          {
            userId: req.params.otherUserId,
            joinedAt: new Date(),
            role: "member",
            lastReadAt: new Date(),
          },
        ],
        createdBy: req.user.id,
      });
    }
    res.json({ success: true, data: { roomId: room.roomId, type: room.type } });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getUserChatRooms = async (req, res) => {
  try {
    const rooms = await ChatRoom.find({ "participants.userId": req.user.id })
      .sort({ updatedAt: -1 })
      .lean();
    const formatted = await Promise.all(
      rooms.map(async (room) => {
        const lastMsg = await Message.findOne({
          roomId: room.roomId,
          isDeleted: false,
          deletedFor: { $ne: req.user.id },
        })
          .sort({ createdAt: -1 })
          .select("message type createdAt sender senderName readBy")
          .lean();
        const other =
          room.type === "direct"
            ? room.participants.find((p) => p.userId.toString() !== req.user.id)
            : null;
        const otherUser = other
          ? await User.findById(other.userId).select("name").lean()
          : null;
        const otherProfile = other
          ? await Profile.findOne({ user: other.userId })
              .select("profilePicture")
              .lean()
          : null;
        return {
          roomId: room.roomId,
          type: room.type,
          name: otherUser?.name || room.name || "Unknown",
          otherUserId: other?.userId?.toString() || null,
          otherUserAvatar: otherProfile?.profilePicture || null,
          lastMessage: lastMsg
            ? {
                message:
                  lastMsg.type === "audio"
                    ? "🎤 Voice message"
                    : lastMsg.message,
                sentAt: lastMsg.createdAt,
                senderId: lastMsg.sender?.toString(),
                senderName: lastMsg.senderName,
                type: lastMsg.type,
                readBy: (lastMsg.readBy || []).map(
                  (r) => r.user?.toString() || r.toString(),
                ),
              }
            : null,
          updatedAt: lastMsg?.createdAt || room.updatedAt,
          participants: room.participants.map((p) => p.userId.toString()),
        };
      }),
    );
    res.json({ success: true, data: formatted });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.getRoomDetails = async (req, res) => {
  try {
    const room = await ChatRoom.findOne({ roomId: req.params.roomId }).lean();
    if (!room)
      return res
        .status(404)
        .json({ success: false, message: "Room not found" });
    let otherUser = null;
    if (room.type === "direct") {
      const otherId = room.participants.find(
        (p) => p.toString() !== req.user.id,
      );
      if (otherId) {
        const user = await User.findById(otherId).select("name").lean();
        const profile = await Profile.findOne({ user: otherId })
          .select("profilePicture")
          .lean();
        otherUser = { ...user, avatar: profile?.profilePicture || "" };
      }
    }
    res.json({ success: true, data: { ...room, otherUser } });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── MESSAGE CONTROLLERS ──────────────────────────────────────

exports.getMessageHistory = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before } = req.query;
    const messages = await Message.getMessages(
      roomId,
      parseInt(limit),
      before,
      req.user.id,
    );
    res.json({
      success: true,
      data: {
        roomId,
        messages: messages.reverse().map((m) => formatMessage(m, req.user.id)),
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ NEW: Lightweight endpoint
exports.getMessagesLight = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 30, before } = req.query;
    const messages = await Message.getMessagesLight(
      roomId,
      parseInt(limit),
      before,
      req.user.id,
    );
    res.json({
      success: true,
      data: {
        roomId,
        messages: messages.reverse().map((m) => formatMessage(m, req.user.id)),
        hasMore: messages.length === parseInt(limit),
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const msg = await Message.findById(req.params.messageId);
    if (!msg)
      return res.status(404).json({ success: false, message: "Not found" });
    if (msg.sender.toString() !== req.user.id)
      return res.status(403).json({ success: false, message: "Unauthorized" });
    msg.isDeleted = true;
    msg.deletedFor.push(req.user.id);
    await msg.save();
    res.json({ success: true, message: "Deleted" });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markMessageAsRead = async (req, res) => {
  try {
    const msg = await Message.markMessageAsRead(
      req.params.messageId,
      req.user.id,
    );
    if (!msg)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({ success: true, data: msg });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markMessageAsDelivered = async (req, res) => {
  try {
    const msg = await Message.markMessageAsDelivered(
      req.params.messageId,
      req.user.id,
    );
    res.json({ success: true, data: msg });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── READ / UNREAD ────────────────────────────────────────────

exports.markRoomAsRead = async (req, res) => {
  try {
    const count = await Message.markRoomAsRead(req.params.roomId, req.user.id);
    res.json({ success: true, modifiedCount: count });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.markRoomAsUnread = async (req, res) => {
  try {
    const lastMsg = await Message.findOne({ roomId: req.params.roomId }).sort({
      createdAt: -1,
    });
    if (lastMsg) {
      lastMsg.readBy = lastMsg.readBy.filter(
        (r) => r.user.toString() !== req.user.id,
      );
      await lastMsg.save();
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── UPLOADS ──────────────────────────────────────────────────

exports.uploadAudio = async (req, res) => {
  try {
    const {
      roomId,
      duration,
      replyToId,
      replyToMessage,
      replyToSender,
      replyToSenderId,
      replyToType,
      replyToMediaUrl,
      replyToDuration,
    } = req.body;
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file" });

    const user = await User.findById(req.user.id);
    const profile = await Profile.findOne({ user: req.user.id });
    const audioUrl = `/uploads/chat/audio/${req.file.filename}`;

    const data = {
      sender: req.user.id,
      senderName: user.name,
      senderAvatar: profile?.profilePicture || "",
      roomId,
      message: "🎤 Voice message",
      type: "audio",
      mediaUrl: audioUrl,
      mediaSize: req.file.size,
      mediaName: req.file.originalname,
      mediaMimeType: req.file.mimetype,
      duration: parseInt(duration) || 0,
      readBy: [{ user: req.user.id, readAt: new Date() }],
      deliveredTo: [{ user: req.user.id, deliveredAt: new Date() }],
    };

    if (replyToId) {
      data.replyTo = {
        messageId: replyToId,
        message: replyToMessage,
        senderName: replyToSender,
        senderId: replyToSenderId,
        type: replyToType,
        mediaUrl: replyToMediaUrl,
        duration: parseInt(replyToDuration) || 0,
      };
    }

    const msg = await Message.create(data);

    // 🔴 BROADCAST TO ROOM VIA SOCKET
    const io = req.app.get("io");
    if (io) {
      const formattedMsg = formatMessage(msg, req.user.id);
      // Broadcast to everyone EXCEPT sender (sender already has optimistic message)
      socket.to(roomId).emit("receive_message", formattedMsg);
      // Or broadcast to everyone including sender:
      // io.to(roomId).emit('receive_message', formattedMsg);
      console.log(`📡 Audio broadcast to room: ${roomId}`);
    }

    await ChatRoom.findOneAndUpdate(
      { roomId },
      {
        lastMessage: {
          message: "🎤 Voice message",
          sentAt: new Date(),
          senderId: req.user.id,
          senderName: user.name,
          type: "audio",
          readBy: [req.user.id],
        },
        updatedAt: new Date(),
        $inc: { messageCount: 1 },
      },
      { upsert: true },
    );

    res.json({
      success: true,
      url: audioUrl,
      data: formatMessage(msg, req.user.id),
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.uploadAttachments = async (req, res) => {
  try {
    const { roomId } = req.body;
    const user = await User.findById(req.user.id);
    const profile = await Profile.findOne({ user: req.user.id });

    if (req.body.type === "location") {
      const loc =
        typeof req.body.locationData === "string"
          ? JSON.parse(req.body.locationData)
          : req.body.locationData;
      const msg = await Message.create({
        sender: req.user.id,
        senderName: user.name,
        senderAvatar: profile?.profilePicture || "",
        roomId,
        message: `📍 ${loc?.locationName || "Location"}`,
        type: "location",
        locationData: loc,
        readBy: [{ user: req.user.id }],
        deliveredTo: [{ user: req.user.id }],
      });

      // 🔴 BROADCAST LOCATION
      const io = req.app.get("io");
      if (io) {
        const formattedMsg = formatMessage(msg, req.user.id);
        io.to(roomId).emit("receive_message", formattedMsg);
        console.log(`📡 Location broadcast to room: ${roomId}`);
      }

      await ChatRoom.findOneAndUpdate(
        { roomId },
        {
          lastMessage: {
            message: msg.message,
            sentAt: new Date(),
            senderId: req.user.id,
            senderName: user.name,
            type: "location",
            readBy: [req.user.id],
          },
          updatedAt: new Date(),
          $inc: { messageCount: 1 },
        },
        { upsert: true },
      );
      return res.json({
        success: true,
        data: [formatMessage(msg, req.user.id)],
      });
    }

    if (!req.files?.length)
      return res.status(400).json({ success: false, message: "No files" });

    const messages = await Promise.all(
      req.files.map(async (file) => {
        const isImage = file.mimetype.startsWith("image/");
        const isVideo = file.mimetype.startsWith("video/");
        return Message.create({
          sender: req.user.id,
          senderName: user.name,
          senderAvatar: profile?.profilePicture || "",
          roomId,
          message: isImage
            ? "📷 Photo"
            : isVideo
              ? "🎥 Video"
              : `📎 ${file.originalname}`,
          type: isImage ? "image" : isVideo ? "video" : "file",
          mediaUrl: `/uploads/chat/attachments/${file.filename}`,
          thumbnailUrl: file.thumbnailUrl || "",
          mediaSize: file.size,
          mediaName: file.originalname,
          mediaMimeType: file.mimetype,
          readBy: [{ user: req.user.id }],
          deliveredTo: [{ user: req.user.id }],
        });
      }),
    );

    // 🔴 BROADCAST ALL ATTACHMENTS TO ROOM
    const io = req.app.get("io");
    const formattedMessages = messages.map((m) =>
      formatMessage(m, req.user.id),
    );

    if (io) {
      formattedMessages.forEach((msg) => {
        io.to(roomId).emit("receive_message", msg);
        console.log(
          `📡 Attachment broadcast to room: ${roomId}, msg: ${msg._id}`,
        );
      });
    }

    const lastMsg = messages[messages.length - 1];
    await ChatRoom.findOneAndUpdate(
      { roomId },
      {
        lastMessage: {
          message:
            messages.length === 1
              ? lastMsg.message
              : `📎 ${messages.length} attachments`,
          sentAt: new Date(),
          senderId: req.user.id,
          senderName: user.name,
          type: lastMsg.type,
          readBy: [req.user.id],
        },
        updatedAt: new Date(),
        $inc: { messageCount: messages.length },
      },
      { upsert: true },
    );

    res.json({
      success: true,
      data: formattedMessages,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// ── AUDIO ────────────────────────────────────────────────────

exports.markAudioAsPlayed = async (req, res) => {
  try {
    await Message.markAudioAsPlayed(req.params.messageId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── REACTIONS ────────────────────────────────────────────────

exports.addReaction = async (req, res) => {
  try {
    const { reaction, remove } = req.body;
    if (remove) {
      const msg = await Message.removeReaction(
        req.params.messageId,
        req.user.id,
      );
      return res.json({ success: true, reactions: msg?.reactions || [] });
    }
    const msg = await Message.toggleReaction(
      req.params.messageId,
      req.user.id,
      reaction,
    );
    res.json({ success: true, reactions: msg?.reactions || [] });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

exports.removeReaction = async (req, res) => {
  try {
    const msg = await Message.removeReaction(req.params.messageId, req.user.id);
    res.json({ success: true, reactions: msg?.reactions || [] });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ── USER ─────────────────────────────────────────────────────

exports.getOtherUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.otherUserId)
      .select("name username")
      .lean();
    const profile = await Profile.findOne({ user: req.params.otherUserId })
      .select("profilePicture bio")
      .lean();
    if (!user)
      return res.status(404).json({ success: false, message: "Not found" });
    res.json({
      success: true,
      data: {
        ...user,
        profilePicture: profile?.profilePicture,
        bio: profile?.bio,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: "Server error" });
  }
};
