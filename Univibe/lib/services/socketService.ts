import io from "socket.io-client";
import type { Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_BASE_URL } from "../../constants/ipConstants";

// -----------------------------------------------------------------------------
// Type Definitions
// -----------------------------------------------------------------------------

interface Message {
  _id?: string;
  messageId?: string;
  sender: string;
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  message: string;
  type: string;
  createdAt?: Date;
  status?: string;
  mediaUrl?: string;
  duration?: number;
  readBy?: Array<{ user: string; readAt: Date }>;
  deliveredTo?: Array<{ user: string; deliveredAt: Date }>;
  replyTo?: {
    messageId: string;
    message: string;
    senderName: string;
    senderId?: string;
    type?: string;
    mediaUrl?: string;
    duration?: number;
  };
}

interface UserStatus {
  userId: string;
  userInfo?: any;
  lastSeen?: Date;
  timestamp?: Date;
}

interface TypingData {
  userId: string;
  userName: string;
  roomId: string;
}

interface RoomData {
  roomId: string;
  success: boolean;
}

interface CallData {
  fromUserId: string;
  fromUserInfo?: any;
  callType?: string;
  offer?: any;
  answer?: any;
  candidate?: any;
  timestamp?: Date;
}

interface ReplyToData {
  messageId: string;
  message: string;
  senderName: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

interface ReadReceiptData {
  roomId: string;
  userId: string;
  readAt?: string;
}

interface MessageReadData {
  messageId: string;
  roomId: string;
  userId: string;
  readAt?: string;
}

interface ReactionData {
  messageId: string;
  userId: string;
  reaction?: string;
  reactions?: any[];
}

interface DeleteMessageData {
  roomId: string;
  messageId: string;
  deletedBy: string;
  timestamp?: Date;
}

type EventCallback = (data: any) => void;

// -----------------------------------------------------------------------------
// Socket URL Configuration
// -----------------------------------------------------------------------------

/** Resolves the socket server URL, handling Android emulator localhost */
const getSocketUrl = (): string => {
  let baseUrl = API_BASE_URL.replace(/\/api$/, "").replace(/\/$/, "");

  if (Platform.OS === "android" && baseUrl.includes("localhost")) {
    baseUrl = baseUrl.replace("localhost", "10.0.2.2");
  }

  return baseUrl;
};

const SOCKET_URL = getSocketUrl();

// -----------------------------------------------------------------------------
// SocketService Class
// -----------------------------------------------------------------------------

/**
 * Singleton service that manages a Socket.IO connection.
 *
 * Responsibilities:
 * - Establishes authenticated WebSocket connections
 * - Manages room subscriptions (join/leave)
 * - Routes server events to registered client listeners
 * - Handles automatic reconnection with retry logic
 * - Tracks pending rooms for rejoin after reconnect
 */
class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private pendingRooms: Array<{
    roomId: string;
    otherUserId: string | null;
    type: string;
  }> = [];
  private connectionRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  /**
   * Establishes a socket connection using the stored auth token.
   * Retries if token is not yet available.
   */
  async connect(): Promise<Socket | null> {
    try {
      const token = await SecureStore.getItemAsync("authToken");

      if (!token) {
        if (this.connectionRetryTimeout) {
          clearTimeout(this.connectionRetryTimeout);
        }
        this.connectionRetryTimeout = setTimeout(() => {
          this.connect();
        }, 2000);
        return null;
      }

      if (this.socket && this.isConnected) {
        return this.socket;
      }

      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.setupEventListeners();
      return this.socket;
    } catch (error) {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Room Reconnection
  // ---------------------------------------------------------------------------

  /**
   * Rejoins all previously joined rooms after a reconnection.
   * Clears the pending list to avoid duplicate joins.
   */
  rejoinRooms(): void {
    if (this.pendingRooms.length === 0) return;

    const roomsToJoin = [...this.pendingRooms];
    this.pendingRooms = [];

    roomsToJoin.forEach((room) => {
      this.joinRoom(room.roomId, room.otherUserId, room.type);
    });
  }

  // ---------------------------------------------------------------------------
  // Socket Event Forwarding
  // ---------------------------------------------------------------------------

  /**
   * Sets up all socket.io event listeners.
   * Server events are forwarded to registered client listeners via emitEvent.
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on("connect", () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emitEvent("socket_connected", {});
      this.rejoinRooms();
    });

    this.socket.on("disconnect", (reason: string) => {
      this.isConnected = false;
      this.emitEvent("socket_disconnected", { reason });

      if (reason === "io server disconnect" || reason === "transport close") {
        setTimeout(() => this.connect(), 1000);
      }
    });

    this.socket.on("connect_error", (error: Error) => {
      this.reconnectAttempts++;
      this.emitEvent("socket_error", error);
    });

    this.socket.on("reconnect", (_attemptNumber: number) => {
      this.isConnected = true;
      this.emitEvent("socket_reconnected", {});
      this.rejoinRooms();
    });

    this.socket.on("reconnect_failed", () => {
      this.emitEvent("socket_reconnect_failed", {});
    });

    // Chat events
    this.socket.on("receive_message", (message: Message) => {
      this.emitEvent("receive_message", message);
      this.emitEvent("new_message", message);
    });

    this.socket.on("message_delivered", (message: Message) => {
      this.emitEvent("message_delivered", message);
    });

    this.socket.on("room_joined", (data: RoomData) => {
      this.emitEvent("room_joined", data);
    });

    // Read receipts
    this.socket.on("messages_read", (data: ReadReceiptData) => {
      this.emitEvent("messages_read", data);
    });

    this.socket.on("message_read", (data: MessageReadData) => {
      this.emitEvent("message_read", data);
    });

    this.socket.on(
      "messages_marked_read",
      (data: { roomId: string; modifiedCount: number }) => {
        this.emitEvent("messages_marked_read", data);
      },
    );

    this.socket.on(
      "message_delivered_to_recipient",
      (data: { messageId: string; recipientId: string }) => {
        this.emitEvent("message_delivered_to_recipient", data);
      },
    );

    // Message deletion
    this.socket.on("message_deleted", (data: DeleteMessageData) => {
      this.emitEvent("message_deleted", data);
    });

    // Reactions
    this.socket.on("reaction_added", (data: ReactionData) => {
      this.emitEvent("reaction_added", data);
    });

    this.socket.on("reaction_removed", (data: ReactionData) => {
      this.emitEvent("reaction_removed", data);
    });

    // Typing indicators
    this.socket.on("typing", (data: TypingData) => {
      this.emitEvent("typing", data);
      this.emitEvent("user_typing", data);
    });

    this.socket.on("stop_typing", (data: TypingData) => {
      this.emitEvent("stop_typing", data);
      this.emitEvent("user_stop_typing", data);
    });

    // User presence
    this.socket.on("user_online", (data: UserStatus) => {
      this.emitEvent("user_online", data);
    });

    this.socket.on("user_offline", (data: UserStatus) => {
      this.emitEvent("user_offline", data);
    });

    this.socket.on(
      "user_joined_room",
      (data: { userId: string; roomId: string }) => {
        this.emitEvent("user_joined_room", data);
      },
    );

    // WebRTC signaling
    this.socket.on("call_user", (data: CallData) => {
      this.emitEvent("incoming_call", data);
    });

    this.socket.on("call_accepted", (data: CallData) => {
      this.emitEvent("call_accepted", data);
    });

    this.socket.on("call_rejected", (data: CallData) => {
      this.emitEvent("call_rejected", data);
    });

    this.socket.on("offer", (data: CallData) => {
      this.emitEvent("call_offer", data);
    });

    this.socket.on("answer", (data: CallData) => {
      this.emitEvent("call_answer", data);
    });

    this.socket.on("ice_candidate", (data: CallData) => {
      this.emitEvent("ice_candidate", data);
    });

    this.socket.on("end_call", (data: CallData) => {
      this.emitEvent("call_ended", data);
    });

    // Error handling
    this.socket.on("error", (error: Error) => {
      this.emitEvent("socket_error", error);
    });

    this.socket.on("message_error", (error: any) => {
      if (!error) {
        this.emitEvent("message_error", { message: "Unknown server error" });
        return;
      }
      this.emitEvent("message_error", error);
    });
  }

  // ---------------------------------------------------------------------------
  // Event Management (Client-Side Listeners)
  // ---------------------------------------------------------------------------

  /** Registers a listener for a custom event */
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  /** Removes a specific listener for a custom event */
  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  /** Removes all listeners for an event, or all listeners entirely */
  removeAllListeners(event?: string): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }

  /** Calls all registered listeners for a given event */
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          // Prevent one failing listener from breaking others
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Chat Actions
  // ---------------------------------------------------------------------------

  /**
   * Joins a chat room so the server routes relevant events to this socket.
   * If not connected, queues the room for joining when connection is established.
   */
  joinRoom(
    roomId: string,
    otherUserId: string | null = null,
    type: string = "direct",
  ): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("join_room", { roomId, type, otherUserId });

      const alreadyPending = this.pendingRooms.some((r) => r.roomId === roomId);
      if (!alreadyPending) {
        this.pendingRooms.push({ roomId, otherUserId, type });
      }
    } else {
      const alreadyPending = this.pendingRooms.some((r) => r.roomId === roomId);
      if (!alreadyPending) {
        this.pendingRooms.push({ roomId, otherUserId, type });
      }
      this.connect();
    }
  }

  /** Leaves a chat room and removes it from pending rejoin tracking */
  leaveRoom(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("leave_room", { roomId });
      this.pendingRooms = this.pendingRooms.filter((r) => r.roomId !== roomId);
    }
  }

  /** Sends a message to a room via the socket */
  sendMessage(
    roomId: string,
    message: string,
    type: string = "text",
    replyTo?: ReplyToData,
    tempId?: string,
    mediaUrl?: string,
    duration?: number,
  ): void {
    if (this.socket && this.isConnected) {
      const data: any = { roomId, message, type, replyTo };
      if (tempId) data.tempId = tempId;
      if (mediaUrl) data.mediaUrl = mediaUrl;
      if (duration) data.duration = duration;

      this.socket.emit("send_message", data);
    } else {
      this.emitEvent("message_error", {
        tempId,
        error: "Socket not connected",
      });
      this.connect();
    }
  }

  /** Marks all messages in a room as read */
  markRoomAsRead(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("mark_read", { roomId });
    } else {
      this.connect();
    }
  }

  /** Marks a single message as read */
  markMessageAsRead(messageId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("mark_message_read", { messageId });
    }
  }

  /** Adds a reaction to a message */
  addReaction(messageId: string, reaction: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("add_reaction", { messageId, reaction });
    }
  }

  /** Removes a reaction from a message */
  removeReaction(messageId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("remove_reaction", { messageId });
    }
  }

  /** Emits a delete event for a message */
  deleteMessage(messageId: string, roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("delete_message", { messageId, roomId });
    }
  }

  /** Sends a typing indicator for a room */
  sendTyping(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("typing", { roomId });
    }
  }

  /** Stops the typing indicator for a room */
  stopTyping(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("stop_typing", { roomId });
    }
  }

  /** Requests message history from the server */
  getMessageHistory(
    roomId: string,
    limit: number = 50,
    before: string | null = null,
  ): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("get_messages", { roomId, limit, before });
    }
  }

  // ---------------------------------------------------------------------------
  // WebRTC Signaling
  // ---------------------------------------------------------------------------

  callUser(
    targetUserId: string,
    callType: string = "video",
    offer: any = null,
  ): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("call_user", { targetUserId, callType, offer });
    }
  }

  acceptCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("call_accepted", { targetUserId });
    }
  }

  rejectCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("call_rejected", { targetUserId });
    }
  }

  sendOffer(targetUserId: string, offer: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("offer", { targetUserId, offer });
    }
  }

  sendAnswer(targetUserId: string, answer: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("answer", { targetUserId, answer });
    }
  }

  sendICECandidate(targetUserId: string, candidate: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("ice_candidate", { targetUserId, candidate });
    }
  }

  endCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("end_call", { targetUserId });
    }
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  /** Emits a custom event to the server */
  emit(event: string, data: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit(event, data);
    } else {
      this.emitEvent("socket_error", { message: "Socket not connected" });
    }
  }

  /** Disconnects the socket and clears all state */
  disconnect(): void {
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
      this.connectionRetryTimeout = null;
    }

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.pendingRooms = [];
    }
  }

  /** Forces a full disconnect and reconnect cycle */
  reconnect(): void {
    this.disconnect();
    this.connect();
  }

  /** Returns whether the socket is currently connected */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /** Returns the socket ID if connected */
  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

// -----------------------------------------------------------------------------
// Singleton Export
// -----------------------------------------------------------------------------

export default new SocketService();
export { SocketService };
