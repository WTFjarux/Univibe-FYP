/**
 * services/socketService.ts
 * 
 * Manages real-time WebSocket connections for chat, typing indicators,
 * user presence, and WebRTC signaling.
 * 
 * Features:
 * - Automatic reconnection with retry logic
 * - Authentication via JWT token
 * - Room-based message isolation
 * - Real-time typing indicators
 * - User online/offline presence
 * - WhatsApp-level read receipts
 * - Message reactions
 * - WebRTC signaling for future calls
 */

import io from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../../constants/ipConstants';

// ============================================
// TYPE DEFINITIONS
// ============================================

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

// ============================================
// SOCKET URL CONFIGURATION
// ============================================

const getSocketUrl = (): string => {
  let baseUrl = API_BASE_URL.replace(/\/api$/, '').replace(/\/$/, '');

  if (Platform.OS === 'android' && baseUrl.includes('localhost')) {
    baseUrl = baseUrl.replace('localhost', '10.0.2.2');
  }

  console.log('🔌 Socket URL:', baseUrl);
  return baseUrl;
};

const SOCKET_URL = getSocketUrl();

// ============================================
// SOCKET SERVICE CLASS
// ============================================

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private pendingRooms: Array<{ roomId: string; otherUserId: string | null; type: string }> = [];
  private connectionRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {}

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

  /**
   * Establish socket connection with authentication
   */
  async connect(): Promise<Socket | null> {
    try {
      const token = await SecureStore.getItemAsync('authToken');

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

      console.log('🔌 Connecting to Socket.IO at:', SOCKET_URL);

      this.socket = io(SOCKET_URL, {
        auth: { token },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
      });

      this.setupEventListeners();
      return this.socket;
    } catch (error) {
      console.error('Socket connection error:', error);
      return null;
    }
  }

  /**
   * Set up all socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // ============================================
    // CONNECTION EVENTS
    // ============================================

    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully! ID:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emitEvent('socket_connected', {});

      if (this.pendingRooms.length > 0) {
        console.log(`📦 Joining ${this.pendingRooms.length} pending rooms`);
        this.pendingRooms.forEach(room => {
          this.socket?.emit('join_room', {
            roomId: room.roomId,
            type: room.type,
            otherUserId: room.otherUserId
          });
        });
        this.pendingRooms = [];
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('❌ Socket disconnected. Reason:', reason);
      this.isConnected = false;
      this.emitEvent('socket_disconnected', { reason });

      if (reason === 'io server disconnect' || reason === 'transport close') {
        console.log('🔄 Attempting to reconnect...');
        setTimeout(() => this.connect(), 1000);
      }
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('❌ Socket connection error:', error.message);
      this.reconnectAttempts++;
      console.log(`🔄 Reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      this.emitEvent('socket_error', error);
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log('🔄 Socket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
      this.emitEvent('socket_reconnected', {});
    });

    this.socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed after maximum attempts');
      this.emitEvent('socket_reconnect_failed', {});
    });

    // ============================================
    // CHAT EVENTS
    // ============================================

    this.socket.on('receive_message', (message: Message) => {
      console.log('📨 Received message:', message.message?.substring(0, 50));
      this.emitEvent('receive_message', message);
      this.emitEvent('new_message', message);
    });

    this.socket.on('message_delivered', (message: Message) => {
      console.log('✅ Message delivered:', message._id);
      this.emitEvent('message_delivered', message);
    });

    this.socket.on('room_joined', (data: RoomData) => {
      console.log('🏠 Room joined:', data.roomId);
      this.emitEvent('room_joined', data);
    });

    // ============================================
    // 🔴 READ RECEIPT EVENTS (WHATSAPP-LEVEL)
    // ============================================

    this.socket.on('messages_read', (data: ReadReceiptData) => {
      console.log(`📖 Messages read in room ${data.roomId} by ${data.userId}`);
      this.emitEvent('messages_read', data);
    });

    this.socket.on('message_read', (data: MessageReadData) => {
      console.log(`📖 Message ${data.messageId} read by ${data.userId}`);
      this.emitEvent('message_read', data);
    });

    this.socket.on('messages_marked_read', (data: { roomId: string; modifiedCount: number }) => {
      console.log(`✅ Marked ${data.modifiedCount} messages as read in room ${data.roomId}`);
      this.emitEvent('messages_marked_read', data);
    });

    this.socket.on('message_delivered_to_recipient', (data: { messageId: string; recipientId: string }) => {
      console.log(`✅ Message ${data.messageId} delivered to ${data.recipientId}`);
      this.emitEvent('message_delivered_to_recipient', data);
    });

    // ============================================
    // 🔴 MESSAGE DELETION EVENTS
    // ============================================

    this.socket.on('message_deleted', (data: DeleteMessageData) => {
      console.log(`🗑️ Message ${data.messageId} deleted in room ${data.roomId}`);
      this.emitEvent('message_deleted', data);
    });

    // ============================================
    // 🔴 REACTION EVENTS
    // ============================================

    this.socket.on('reaction_added', (data: ReactionData) => {
      console.log(`👍 Reaction added to ${data.messageId}: ${data.reaction}`);
      this.emitEvent('reaction_added', data);
    });

    this.socket.on('reaction_removed', (data: ReactionData) => {
      console.log(`👎 Reaction removed from ${data.messageId}`);
      this.emitEvent('reaction_removed', data);
    });

    // ============================================
    // TYPING EVENTS
    // ============================================

    this.socket.on('typing', (data: TypingData) => {
      this.emitEvent('typing', data);
      this.emitEvent('user_typing', data);
    });

    this.socket.on('stop_typing', (data: TypingData) => {
      this.emitEvent('stop_typing', data);
      this.emitEvent('user_stop_typing', data);
    });

    // ============================================
    // USER PRESENCE EVENTS
    // ============================================

    this.socket.on('user_online', (data: UserStatus) => {
      console.log('👤 User online:', data.userId);
      this.emitEvent('user_online', data);
    });

    this.socket.on('user_offline', (data: UserStatus) => {
      console.log('👤 User offline:', data.userId);
      this.emitEvent('user_offline', data);
    });

    this.socket.on('user_joined_room', (data: { userId: string; roomId: string }) => {
      console.log(`👤 User ${data.userId} joined room ${data.roomId}`);
      this.emitEvent('user_joined_room', data);
    });

    // ============================================
    // WEBRTC SIGNALING EVENTS
    // ============================================

    this.socket.on('call_user', (data: CallData) => {
      console.log('📞 Incoming call from:', data.fromUserId);
      this.emitEvent('incoming_call', data);
    });

    this.socket.on('call_accepted', (data: CallData) => {
      console.log('✅ Call accepted from:', data.fromUserId);
      this.emitEvent('call_accepted', data);
    });

    this.socket.on('call_rejected', (data: CallData) => {
      console.log('❌ Call rejected from:', data.fromUserId);
      this.emitEvent('call_rejected', data);
    });

    this.socket.on('offer', (data: CallData) => {
      this.emitEvent('call_offer', data);
    });

    this.socket.on('answer', (data: CallData) => {
      this.emitEvent('call_answer', data);
    });

    this.socket.on('ice_candidate', (data: CallData) => {
      this.emitEvent('ice_candidate', data);
    });

    this.socket.on('end_call', (data: CallData) => {
      console.log('📞 Call ended with:', data.fromUserId);
      this.emitEvent('call_ended', data);
    });

    // ============================================
    // ERROR HANDLING
    // ============================================

    this.socket.on('error', (error: Error) => {
      console.error('❌ Socket error:', error);
      this.emitEvent('socket_error', error);
    });

this.socket.on('message_error', (error: any) => {
  if (!error) {
    console.error('❌ Message error: Unknown server error');
    this.emitEvent('message_error', { message: 'Unknown server error' });
    return;
  }
  console.error('❌ Message error:', error.message || error.error || 'Unknown error');
  this.emitEvent('message_error', error);
    });
  }

  // ============================================
  // EVENT MANAGEMENT
  // ============================================

  /**
   * Register event listener
   */
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) listeners.splice(index, 1);
    }
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.eventListeners.delete(event);
    } else {
      this.eventListeners.clear();
    }
  }

  /**
   * Emit event to all registered listeners
   */
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================
  // CHAT ACTIONS
  // ============================================

  /**
   * Join a chat room
   */
  joinRoom(roomId: string, otherUserId: string | null = null, type: string = 'direct'): void {
    if (this.socket && this.isConnected) {
      console.log(`🏠 Joining room: ${roomId}`);
      this.socket.emit('join_room', { roomId, type, otherUserId });
    } else {
      console.log(`⏳ Socket not connected, queueing room join: ${roomId}`);
      this.pendingRooms.push({ roomId, otherUserId, type });
      this.connect();
    }
  }

  /**
   * Leave a chat room
   */
  leaveRoom(roomId: string): void {
    if (this.socket && this.isConnected) {
      console.log(`👋 Leaving room: ${roomId}`);
      this.socket.emit('leave_room', { roomId });
    }
  }

  /**
   * Send a message to a room
   */
  sendMessage(
    roomId: string,
    message: string,
    type: string = "text",
    replyTo?: ReplyToData,
    tempId?: string,
    mediaUrl?: string,
    duration?: number
  ): void {
    if (this.socket && this.isConnected) {
      console.log(`📤 Sending ${type} message to room ${roomId}`);
      
      const data: any = { roomId, message, type, replyTo };
      if (tempId) data.tempId = tempId;
      if (mediaUrl) data.mediaUrl = mediaUrl;
      if (duration) data.duration = duration;
      
      this.socket.emit("send_message", data);
    } else {
      console.error("❌ Cannot send message - socket not connected");
      this.emitEvent("message_error", { 
        tempId, 
        error: "Socket not connected" 
      });
      this.connect();
    }
  }

  /**
   * 🔴 Mark all messages in a room as read (WhatsApp-level)
   */
  markRoomAsRead(roomId: string): void {
    if (this.socket && this.isConnected) {
      console.log(`📖 Marking room as read: ${roomId}`);
      this.socket.emit('mark_read', { roomId });
    } else {
      console.error(`❌ Cannot mark room as read - socket not connected`);
      this.connect();
    }
  }

  /**
   * 🔴 Mark a single message as read
   */
  markMessageAsRead(messageId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('mark_message_read', { messageId });
    }
  }

  /**
   * 🔴 Add reaction to a message
   */
  addReaction(messageId: string, reaction: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('add_reaction', { messageId, reaction });
    }
  }

  /**
   * 🔴 Remove reaction from a message
   */
  removeReaction(messageId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('remove_reaction', { messageId });
    }
  }

  /**
   * Delete a message
   */
  deleteMessage(messageId: string, roomId: string): void {
    if (this.socket && this.isConnected) {
      console.log(`🗑️ Deleting message: ${messageId}`);
      this.socket.emit('delete_message', { messageId, roomId });
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', { roomId });
    }
  }

  /**
   * Stop typing indicator
   */
  stopTyping(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('stop_typing', { roomId });
    }
  }

  /**
   * Request message history
   */
  getMessageHistory(roomId: string, limit: number = 50, before: string | null = null): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('get_messages', { roomId, limit, before });
    }
  }

  // ============================================
  // WEBRTC SIGNALING
  // ============================================

  callUser(targetUserId: string, callType: string = 'video', offer: any = null): void {
    if (this.socket && this.isConnected) {
      console.log(`📞 Calling user: ${targetUserId}`);
      this.socket.emit('call_user', { targetUserId, callType, offer });
    }
  }

  acceptCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_accepted', { targetUserId });
    }
  }

  rejectCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_rejected', { targetUserId });
    }
  }

  sendOffer(targetUserId: string, offer: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('offer', { targetUserId, offer });
    }
  }

  sendAnswer(targetUserId: string, answer: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('answer', { targetUserId, answer });
    }
  }

  sendICECandidate(targetUserId: string, candidate: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('ice_candidate', { targetUserId, candidate });
    }
  }

  endCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      console.log(`📞 Ending call with: ${targetUserId}`);
      this.socket.emit('end_call', { targetUserId });
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  /**
   * Emit a custom event to the server
   */
  emit(event: string, data: any): void {
    if (this.socket && this.isConnected) {
      console.log(`📡 Emitting event: ${event}`);
      this.socket.emit(event, data);
    } else {
      console.error(`❌ Cannot emit ${event} - socket not connected`);
      this.emitEvent('socket_error', { message: 'Socket not connected' });
    }
  }

  /**
   * Disconnect the socket
   */
  disconnect(): void {
    if (this.connectionRetryTimeout) {
      clearTimeout(this.connectionRetryTimeout);
      this.connectionRetryTimeout = null;
    }

    if (this.socket) {
      console.log('🔌 Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.pendingRooms = [];
    }
  }

  /**
   * Manually reconnect
   */
  reconnect(): void {
    console.log('🔄 Manual reconnect requested');
    this.disconnect();
    this.connect();
  }

  /**
   * Get connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

export default new SocketService();
export { SocketService };