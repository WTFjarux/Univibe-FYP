// socket/events.js

const SOCKET_EVENTS = {
  // Room
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  ROOM_JOINED: "room_joined",
  ROOM_LEFT: "room_left",

  // Messaging
  SEND_MESSAGE: "send_message",
  RECEIVE_MESSAGE: "receive_message",
  MESSAGE_DELIVERED: "message_delivered",
  MESSAGE_DELIVERED_TO_RECIPIENT: "message_delivered_to_recipient",

  // Read Receipts (WhatsApp)
  MARK_READ: "mark_read",
  MESSAGES_READ: "messages_read",
  MESSAGES_MARKED_READ: "messages_marked_read",
  MARK_MESSAGE_READ: "mark_message_read",
  MESSAGE_READ: "message_read",

  // Typing
  TYPING: "typing",
  STOP_TYPING: "stop_typing",

  // Audio
  AUDIO_PLAYED: "audio_played",

  // Deletion
  DELETE_MESSAGE: "delete_message",
  MESSAGE_DELETED: "message_deleted",

  // Reactions
  ADD_REACTION: "add_reaction",
  REMOVE_REACTION: "remove_reaction",
  REACTION_ADDED: "reaction_added",
  REACTION_REMOVED: "reaction_removed",

  // User Status
  USER_ONLINE: "user_online",
  USER_OFFLINE: "user_offline",

  // Errors
  ERROR: "error",
  MESSAGE_ERROR: "message_error",
};

module.exports = SOCKET_EVENTS;
