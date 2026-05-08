// lib/services/socketService.ts

import io from "socket.io-client";
import type { Socket } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { API_BASE_URL } from "../../constants/ipConstants";
import type {
  Message,
  SocketMessageData,
  ReadReceiptData,
  MessageDeleteData,
  ReactionData,
  ChatClearedData,
  ChatRestoredData,
  TypingData,
  GroupCreatedData,
  AddedToGroupData,
  RemovedFromGroupData,
  GroupMembersAddedData,
  GroupMemberRemovedData,
  GroupMemberLeftData,
  GroupUpdatedData,
  GroupRoleChangedData,
} from "../types/chat.types";

// -----------------------------------------------------------------------------
// Socket URL Configuration
// -----------------------------------------------------------------------------

const getSocketUrl = (): string => {
  let baseUrl = API_BASE_URL.replace(/\/api$/, "").replace(/\/$/, "");
  if (Platform.OS === "android" && baseUrl.includes("localhost")) {
    baseUrl = baseUrl.replace("localhost", "10.0.2.2");
  }
  return baseUrl.replace(/\/$/, "");
};

const SOCKET_URL = getSocketUrl();

// -----------------------------------------------------------------------------
// Types (only socket-specific types not in chat.types)
// -----------------------------------------------------------------------------

interface ReplyToData {
  messageId: string;
  message: string;
  senderName: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

interface RoomData {
  roomId: string;
  success: boolean;
  roomType?: string;
  roomName?: string;
  isGroup?: boolean;
}

interface UserStatus {
  userId: string;
  userInfo?: any;
  lastSeen?: Date;
  timestamp?: Date;
}

interface ForwardMessageSuccessData {
  success: boolean;
  message: string;
  data: {
    forwardedCount: number;
    forwardedMessages: Message[];
    forwardedToRooms: string[];
  };
}

interface ForwardMessageErrorData {
  success: boolean;
  message: string;
}

interface MessageForwardedToRoomData {
  message: Message;
  roomId: string;
  forwardedBy: string;
  forwardedByName: string;
}

type EventCallback = (data: any) => void;

// -----------------------------------------------------------------------------
// SocketService Class
// -----------------------------------------------------------------------------

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private pendingRooms: Array<{
    roomId: string;
    otherUserId: string | null;
    type: string;
  }> = [];
  private activeRooms: Set<string> = new Set();
  private connectionRetryTimeout: ReturnType<typeof setTimeout> | null = null;
  private isConnecting: boolean = false;

  // ---------------------------------------------------------------------------
  // Connection Management
  // ---------------------------------------------------------------------------

  async connect(): Promise<Socket | null> {
    if (this.isConnecting) return null;
    if (this.socket?.connected) return this.socket;

    this.isConnecting = true;

    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        console.log("⚠️ No auth token found, retrying in 2s...");
        if (this.connectionRetryTimeout) {
          clearTimeout(this.connectionRetryTimeout);
        }
        this.connectionRetryTimeout = setTimeout(() => {
          this.isConnecting = false;
          this.connect();
        }, 2000);
        return null;
      }

      if (this.socket) {
        this.socket.removeAllListeners();
        this.socket.disconnect();
        this.socket = null;
      }

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket"],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 20000,
        forceNew: true,
      });

      this.setupEventListeners();
      this.isConnecting = false;
      return this.socket;
    } catch (error) {
      console.error("❌ Socket connection error:", error);
      this.isConnecting = false;
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Room Reconnection
  // ---------------------------------------------------------------------------

  rejoinRooms(): void {
    if (this.pendingRooms.length === 0) return;

    console.log(`🔄 Rejoining ${this.pendingRooms.length} rooms...`);

    this.pendingRooms.forEach((room) => {
      if (
        this.socket &&
        this.isConnected &&
        !this.activeRooms.has(room.roomId)
      ) {
        this.activeRooms.add(room.roomId);
        this.socket.emit("join_room", {
          roomId: room.roomId,
          type: room.type,
          otherUserId: room.otherUserId,
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Socket Event Forwarding
  // ---------------------------------------------------------------------------

  private setupEventListeners(): void {
    if (!this.socket) return;

    // ===== CONNECTION EVENTS =====
    this.socket.on("connect", () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log("🟢 Socket connected:", this.socket?.id);
      this.emitEvent("socket_connected", {});
      this.rejoinRooms();
    });

    this.socket.on("disconnect", (reason: string) => {
      this.isConnected = false;
      console.log("🔴 Socket disconnected:", reason);
      this.emitEvent("socket_disconnected", { reason });
    });

    this.socket.on("connect_error", (error: Error) => {
      this.reconnectAttempts++;
      if (this.reconnectAttempts % 3 === 0) {
        console.error(
          `❌ Socket connect error (attempt ${this.reconnectAttempts}):`,
          error.message,
        );
      }
      this.emitEvent("socket_error", error);
    });

    this.socket.on("reconnect", (attemptNumber: number) => {
      this.isConnected = true;
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      this.emitEvent("socket_reconnected", {});
      this.rejoinRooms();
    });

    this.socket.on("reconnect_attempt", (attemptNumber: number) => {
      console.log(`🔄 Reconnect attempt ${attemptNumber}...`);
    });

    this.socket.on("reconnect_error", (error: Error) => {
      console.error("❌ Reconnect error:", error.message);
    });

    this.socket.on("reconnect_failed", () => {
      console.error("❌ Socket reconnection failed after max attempts");
      this.emitEvent("socket_reconnect_failed", {});
    });

    // ===== MESSAGE EVENTS =====
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

    this.socket.on(
      "forward_message_success",
      (data: ForwardMessageSuccessData) => {
        this.emitEvent("forward_message_success", data);
      },
    );

    this.socket.on("forward_message_error", (data: ForwardMessageErrorData) => {
      this.emitEvent("forward_message_error", data);
      this.emitEvent("message_error", data);
    });

    this.socket.on(
      "message_forwarded_to_room",
      (data: MessageForwardedToRoomData) => {
        this.emitEvent("message_forwarded_to_room", data);
      },
    );

    // ===== READ RECEIPTS (from chat.types) =====
    this.socket.on("messages_read", (data: ReadReceiptData) => {
      this.emitEvent("messages_read", data);
    });

    this.socket.on(
      "message_read",
      (data: {
        messageId: string;
        roomId: string;
        userId: string;
        readAt: string;
      }) => {
        this.emitEvent("message_read", data);
      },
    );

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

    // ===== MESSAGE DELETED (from chat.types) =====
    this.socket.on("message_deleted", (data: MessageDeleteData) => {
      this.emitEvent("message_deleted", data);
    });

    // ===== REACTIONS (from chat.types) =====
    this.socket.on("reaction_added", (data: ReactionData) => {
      this.emitEvent("reaction_added", data);
    });

    this.socket.on("reaction_removed", (data: ReactionData) => {
      this.emitEvent("reaction_removed", data);
    });

    // ===== CHAT CLEAR/RESTORE (from chat.types) =====
    this.socket.on("chat_cleared", (data: ChatClearedData) => {
      this.emitEvent("chat_cleared", data);
    });

    this.socket.on("chat_restored", (data: ChatRestoredData) => {
      this.emitEvent("chat_restored", data);
    });

    // ===== TYPING INDICATORS (from chat.types) =====
    this.socket.on("typing", (data: TypingData) => {
      this.emitEvent("typing", data);
      this.emitEvent("user_typing", data);
    });

    this.socket.on("stop_typing", (data: TypingData) => {
      this.emitEvent("stop_typing", data);
      this.emitEvent("user_stop_typing", data);
    });

    // ===== USER PRESENCE =====
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

    // ===== GROUP EVENTS (from chat.types) =====
    this.socket.on("group_created", (data: GroupCreatedData) => {
      this.emitEvent("group_created", data);
    });

    this.socket.on("added_to_group", (data: AddedToGroupData) => {
      this.emitEvent("added_to_group", data);
    });

    this.socket.on("removed_from_group", (data: RemovedFromGroupData) => {
      this.emitEvent("removed_from_group", data);
    });

    this.socket.on("group_members_added", (data: GroupMembersAddedData) => {
      this.emitEvent("group_members_added", data);
    });

    this.socket.on("group_member_removed", (data: GroupMemberRemovedData) => {
      this.emitEvent("group_member_removed", data);
    });

    this.socket.on("group_member_left", (data: GroupMemberLeftData) => {
      this.emitEvent("group_member_left", data);
    });

    this.socket.on("group_updated", (data: GroupUpdatedData) => {
      this.emitEvent("group_updated", data);
    });

    this.socket.on("group_role_changed", (data: GroupRoleChangedData) => {
      this.emitEvent("group_role_changed", data);
    });

    this.socket.on(
      "user_joined_group",
      (data: {
        userId: string;
        userName: string;
        roomId: string;
        roomName: string;
      }) => {
        this.emitEvent("user_joined_group", data);
      },
    );

    // ===== NOTIFICATION EVENTS =====
    this.socket.on("notification:new", (data: any) => {
      console.log(data?.notification?.message);
      this.emitEvent("notification:new", data);
    });

    this.socket.on("notification:unreadCount", (data: any) => {
      this.emitEvent("notification:unreadCount", data);
    });

    // ===== STORY EVENTS =====
    this.socket.on("story_created", (data: any) => {
      console.log("📱 Story created:", data);
      this.emitEvent("story_created", data);
    });

    this.socket.on("story_viewed", (data: any) => {
      console.log("👁️ Story viewed:", data);
      this.emitEvent("story_viewed", data);
    });

    this.socket.on("story_deleted", (data: any) => {
      console.log("🗑️ Story deleted:", data);
      this.emitEvent("story_deleted", data);
    });

    // ===== EVENT UPDATES =====
    this.socket.on("event:updated", (data: any) => {
      this.emitEvent("event:updated", data);
    });

    // ===== ERROR EVENTS =====
    this.socket.on("error", (error: Error) => {
      console.error("Socket error:", error.message);
      this.emitEvent("socket_error", error);
    });

    this.socket.on("message_error", (error: any) => {
      this.emitEvent(
        "message_error",
        error || { message: "Unknown server error" },
      );
    });
  }

  // ---------------------------------------------------------------------------
  // Event Management
  // ---------------------------------------------------------------------------

  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
    this.eventListeners.get(event)?.push(callback);
  }

  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }

  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          /* silent */
        }
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Chat Actions
  // ---------------------------------------------------------------------------

  joinRoom(
    roomId: string,
    otherUserId: string | null = null,
    type: string = "direct",
  ): void {
    const alreadyPending = this.pendingRooms.some((r) => r.roomId === roomId);
    if (!alreadyPending) {
      this.pendingRooms.push({ roomId, otherUserId, type });
    }

    if (this.socket && this.isConnected && !this.activeRooms.has(roomId)) {
      this.activeRooms.add(roomId);
      this.socket.emit("join_room", { roomId, type, otherUserId });
    } else if (!this.socket || !this.isConnected) {
      this.connect();
    }
  }

  leaveRoom(roomId: string): void {
    this.activeRooms.delete(roomId);
    if (this.socket && this.isConnected) {
      this.socket.emit("leave_room", { roomId });
      this.pendingRooms = this.pendingRooms.filter((r) => r.roomId !== roomId);
    }
  }

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

  markRoomAsRead(roomId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("mark_read", { roomId });
    else this.connect();
  }

  markMessageAsRead(messageId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("mark_message_read", { messageId });
  }

  addReaction(messageId: string, reaction: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("add_reaction", { messageId, reaction });
  }

  removeReaction(messageId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("remove_reaction", { messageId });
  }

  deleteMessage(messageId: string, roomId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("delete_message", { messageId, roomId });
  }

  clearChat(roomId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("clear_chat", { roomId });
  }

  sendTyping(roomId: string): void {
    if (this.socket && this.isConnected) this.socket.emit("typing", { roomId });
  }

  stopTyping(roomId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("stop_typing", { roomId });
  }

  getMessageHistory(
    roomId: string,
    limit: number = 50,
    before: string | null = null,
  ): void {
    if (this.socket && this.isConnected)
      this.socket.emit("get_messages", { roomId, limit, before });
  }

  forwardMessage(messageId: string, targetChatIds: string[]): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("forward_message", { messageId, targetChatIds });
    } else {
      this.emitEvent("socket_error", {
        message: "Socket not connected",
        action: "forward_message",
      });
      this.connect();
    }
  }

  // ---------------------------------------------------------------------------
  // Group Chat Methods
  // ---------------------------------------------------------------------------

  createGroup(
    name: string,
    participantIds: string[],
    icon?: string,
    description?: string,
  ): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("create_group", {
        name,
        participantIds,
        icon,
        description,
      });
    } else {
      this.emitEvent("socket_error", {
        message: "Socket not connected",
        action: "create_group",
      });
      this.connect();
    }
  }

  addGroupMembers(roomId: string, memberIds: string[]): void {
    if (this.socket && this.isConnected)
      this.socket.emit("add_group_members", { roomId, memberIds });
  }

  removeGroupMember(roomId: string, memberId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("remove_group_member", { roomId, memberId });
  }

  leaveGroup(roomId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("leave_group", { roomId });
  }

  updateGroupInfo(
    roomId: string,
    updates: {
      name?: string;
      icon?: string;
      description?: string;
      settings?: any;
    },
  ): void {
    if (this.socket && this.isConnected)
      this.socket.emit("update_group_info", { roomId, ...updates });
  }

  makeAdmin(roomId: string, memberId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("make_admin", { roomId, memberId });
  }

  removeAdmin(roomId: string, memberId: string): void {
    if (this.socket && this.isConnected)
      this.socket.emit("remove_admin", { roomId, memberId });
  }

  // ---------------------------------------------------------------------------
  // Utility Methods
  // ---------------------------------------------------------------------------

  emit(event: string, data: any): void {
    if (this.socket && this.isConnected) this.socket.emit(event, data);
    else this.emitEvent("socket_error", { message: "Socket not connected" });
  }

  disconnect(): void {
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
      this.connectionRetryTimeout = null;
    }
    this.isConnecting = false;
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
    this.pendingRooms = [];
    this.activeRooms.clear();
  }

  reconnect(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 500);
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

export default new SocketService();
export { SocketService };
