// services/socketService.ts
/**
 * Socket.IO Service
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
 * - WebRTC signaling for future calls
 */

import io, { Socket } from 'socket.io-client';
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

type EventCallback = (data: any) => void;

// Socket URL - Use the same base URL as API
// Remove '/api' if present and ensure it's just the base URL
const getSocketUrl = (): string => {
  // Remove any trailing slashes and '/api' from the base URL
  let baseUrl = API_BASE_URL.replace(/\/api$/, '').replace(/\/$/, '');
  
  // Platform-specific adjustments if needed
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

  constructor() {
    // Initialization happens when connect() is called
  }

  /**
   * Establish socket connection with authentication
   * @returns Socket instance or null if connection fails
   */
  async connect(): Promise<Socket | null> {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      
      if (!token) {
        // Schedule retry if token not available yet
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

      // Clean up existing connection
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

    // Connection events
    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully! ID:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emitEvent('socket_connected', {});
      
      // Join any rooms that were queued while disconnected
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
      
      // Auto-reconnect for unexpected disconnections
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

    // Chat events
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

    // Typing events
    this.socket.on('typing', (data: TypingData) => {
      this.emitEvent('typing', data);
      this.emitEvent('user_typing', data);
    });

    this.socket.on('stop_typing', (data: TypingData) => {
      this.emitEvent('stop_typing', data);
      this.emitEvent('user_stop_typing', data);
    });

    // User presence events
    this.socket.on('user_online', (data: UserStatus) => {
      console.log('👤 User online:', data.userId);
      this.emitEvent('user_online', data);
    });

    this.socket.on('user_offline', (data: UserStatus) => {
      console.log('👤 User offline:', data.userId);
      this.emitEvent('user_offline', data);
    });

    // WebRTC signaling events (future implementation)
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

    // Error handling
    this.socket.on('error', (error: Error) => {
      console.error('❌ Socket error:', error);
      this.emitEvent('socket_error', error);
    });
  }

  

  // ============================================
  // EVENT MANAGEMENT
  // ============================================

  /**
   * Register event listener
   * @param event - Event name
   * @param callback - Callback function
   */
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)?.push(callback);
  }

  /**
   * Remove event listener
   * @param event - Event name
   * @param callback - Callback function to remove
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
   * @param event - Optional event name
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
   * @param event - Event name
   * @param data - Event data
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
   * @param roomId - Room identifier
   * @param otherUserId - Other participant's user ID (for direct chats)
   * @param type - Room type ('direct' or 'group')
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
   * Send a message to a room
   * @param roomId - Room identifier
   * @param message - Message content
   * @param type - Message type ('text', 'image', etc.)
   */
  sendMessage(roomId: string, message: string, type: string = 'text'): void {
    if (this.socket && this.isConnected) {
      console.log(`📤 Sending ${type} message to room ${roomId}`);
      this.socket.emit('send_message', { roomId, message, type });
    } else {
      console.error('❌ Cannot send message - socket not connected');
      this.emitEvent('socket_error', { message: 'Socket not connected' });
      this.connect();
    }
  }

  /**
   * Send typing indicator to a room
   * @param roomId - Room identifier
   */
  sendTyping(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', { roomId });
    }
  }

  /**
   * Stop typing indicator in a room
   * @param roomId - Room identifier
   */
  stopTyping(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('stop_typing', { roomId });
    }
  }

  /**
   * Mark messages as read
   * @param roomId - Room identifier
   * @param messageIds - Array of message IDs
   */
  markMessagesAsRead(roomId: string, messageIds: string[]): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('message_read', { roomId, messageIds });
    }
  }

  /**
   * Request message history for a room
   * @param roomId - Room identifier
   * @param limit - Number of messages to fetch
   * @param before - Timestamp for pagination
   */
  getMessageHistory(roomId: string, limit: number = 50, before: string | null = null): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('get_messages', { roomId, limit, before });
    }
  }

  // ============================================
  // WEBRTC SIGNALING (FUTURE IMPLEMENTATION)
  // ============================================

  /**
   * Initiate a call to another user
   * @param targetUserId - Target user ID
   * @param callType - 'audio' or 'video'
   * @param offer - WebRTC offer
   */
  callUser(targetUserId: string, callType: string = 'video', offer: any = null): void {
    if (this.socket && this.isConnected) {
      console.log(`📞 Calling user: ${targetUserId}`);
      this.socket.emit('call_user', { targetUserId, callType, offer });
    }
  }

  /**
   * Accept an incoming call
   * @param targetUserId - Caller user ID
   */
  acceptCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_accepted', { targetUserId });
    }
  }

  /**
   * Reject an incoming call
   * @param targetUserId - Caller user ID
   */
  rejectCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('call_rejected', { targetUserId });
    }
  }

  /**
   * Send WebRTC offer
   * @param targetUserId - Target user ID
   * @param offer - WebRTC offer
   */
  sendOffer(targetUserId: string, offer: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('offer', { targetUserId, offer });
    }
  }

  /**
   * Send WebRTC answer
   * @param targetUserId - Target user ID
   * @param answer - WebRTC answer
   */
  sendAnswer(targetUserId: string, answer: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('answer', { targetUserId, answer });
    }
  }

  /**
   * Send ICE candidate
   * @param targetUserId - Target user ID
   * @param candidate - ICE candidate
   */
  sendICECandidate(targetUserId: string, candidate: any): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('ice_candidate', { targetUserId, candidate });
    }
  }

  /**
   * End an active call
   * @param targetUserId - Other participant's user ID
   */
  endCall(targetUserId: string): void {
    if (this.socket && this.isConnected) {
      console.log(`📞 Ending call with: ${targetUserId}`);
      this.socket.emit('end_call', { targetUserId });
    }
  }

  // ============================================
  // CONNECTION MANAGEMENT
  // ============================================

   /**
   * Emit a custom event to the server
   * @param event - Event name
   * @param data - Event data
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
   * Disconnect the socket connection
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
   * Manually reconnect the socket
   */
  reconnect(): void {
    console.log('🔄 Manual reconnect requested');
    this.disconnect();
    this.connect();
  }

  /**
   * Get current connection status
   * @returns True if connected, false otherwise
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Get current socket ID
   * @returns Socket ID or null
   */
  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

export default new SocketService();