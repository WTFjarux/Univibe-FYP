// services/socketService.ts
import io, { Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Types
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

// Socket URL based on platform
// For physical device, use your computer's IP address
const SOCKET_URL = Platform.select({
  ios: 'http://192.168.1.14:5001',  // Use your computer's IP for iOS too
  android: 'http://192.168.1.14:5001', // Your computer's IP
  default: 'http://192.168.1.14:5001'
});

console.log('🔌 Socket Service initialized with URL:', SOCKET_URL);

class SocketService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private eventListeners: Map<string, EventCallback[]> = new Map();
  private pendingRooms: Array<{ roomId: string; otherUserId: string | null; type: string }> = [];
private connectionRetryTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    console.log('SocketService created');
  }

  async connect(): Promise<Socket | null> {
    try {
      // Get token from SecureStore (where AuthContext stores it)
      const token = await SecureStore.getItemAsync('authToken');
      
      console.log('🔑 Socket connect - Token found:', !!token);
      
      if (!token) {
        console.log('❌ No authToken found in SecureStore');
        // Schedule a retry after 2 seconds
        if (this.connectionRetryTimeout) {
          clearTimeout(this.connectionRetryTimeout);
        }
        this.connectionRetryTimeout = setTimeout(() => {
          console.log('🔄 Retrying socket connection...');
          this.connect();
        }, 2000);
        return null;
      }

      if (this.socket && this.isConnected) {
        console.log('✅ Socket already connected');
        return this.socket;
      }

      // Close existing socket if any
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      console.log('🔄 Connecting to Socket.IO at:', SOCKET_URL);
      
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
      console.error('❌ Socket connection error:', error);
      return null;
    }
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('✅ Socket connected successfully! ID:', this.socket?.id);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.emitEvent('socket_connected', {});
      
      // Join any pending rooms
      if (this.pendingRooms.length > 0) {
        console.log('📦 Joining pending rooms:', this.pendingRooms.length);
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
      
      // Attempt to reconnect if disconnected unexpectedly
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

    // User status events
    this.socket.on('user_online', (data: UserStatus) => {
      console.log('👤 User online:', data.userId);
      this.emitEvent('user_online', data);
    });

    this.socket.on('user_offline', (data: UserStatus) => {
      console.log('👤 User offline:', data.userId);
      this.emitEvent('user_offline', data);
    });

    // Call events (for future implementation)
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

  // Event emitter for React components
  on(event: string, callback: EventCallback): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
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
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Chat actions
  joinRoom(roomId: string, otherUserId: string | null = null, type: string = 'direct'): void {
    if (this.socket && this.isConnected) {
      console.log(`🏠 Joining room: ${roomId}`);
      this.socket.emit('join_room', { roomId, type, otherUserId });
    } else {
      console.log(`⏳ Socket not connected, queueing room join: ${roomId}`);
      this.pendingRooms.push({ roomId, otherUserId, type });
      // Attempt to reconnect
      this.connect();
    }
  }

  sendMessage(roomId: string, message: string, type: string = 'text'): void {
    if (this.socket && this.isConnected) {
      console.log(`📤 Sending message to room ${roomId}:`, message.substring(0, 50));
      this.socket.emit('send_message', { roomId, message, type });
    } else {
      console.error('❌ Cannot send message - socket not connected');
      this.emitEvent('socket_error', { message: 'Socket not connected' });
      // Try to reconnect
      this.connect();
    }
  }

  sendTyping(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('typing', { roomId });
    }
  }

  stopTyping(roomId: string): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('stop_typing', { roomId });
    }
  }

  markMessagesAsRead(roomId: string, messageIds: string[]): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('message_read', { roomId, messageIds });
    }
  }

  getMessageHistory(roomId: string, limit: number = 50, before: string | null = null): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('get_messages', { roomId, limit, before });
    }
  }

  // Call actions (for future implementation)
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

  reconnect(): void {
    console.log('🔄 Manual reconnect requested');
    this.disconnect();
    this.connect();
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }
}

export default new SocketService();