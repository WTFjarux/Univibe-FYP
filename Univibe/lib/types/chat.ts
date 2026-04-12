// types/chat.ts
export interface Message {
  _id?: string;
  messageId?: string;
  sender: string;
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  message: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  replyTo?: string | null;
  readBy?: Array<{ userId: string; readAt: Date }>;
  isRead?: boolean;
  reactions?: Array<{ userId: string; reaction: string; createdAt: Date }>;
  isDeleted?: boolean;
  status?: 'sent' | 'delivered' | 'read';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChatRoom {
  roomId: string;
  type: 'direct' | 'group';
  name?: string;
  description?: string;
  avatar?: string;
  participants: Array<{
    userId: string;
    joinedAt: Date;
    role: 'member' | 'admin' | 'owner';
    lastReadAt: Date;
  }>;
  createdBy: string;
  lastMessage?: {
    message: string;
    sender: string;
    sentAt: Date;
  };
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TypingEvent {
  userId: string;
  userName: string;
  roomId: string;
}

export interface UserStatusEvent {
  userId: string;
  userInfo?: {
    id: string;
    name: string;
    email: string;
  };
  lastSeen?: Date;
  timestamp?: Date;
}

export interface CallEvent {
  fromUserId: string;
  fromUserInfo?: {
    id: string;
    name: string;
    email: string;
  };
  callType?: 'audio' | 'video';
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  timestamp?: Date;
}

export interface RoomEvent {
  roomId: string;
  success: boolean;
}

export interface ChatContextType {
  isConnected: boolean;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, Record<string, boolean>>;
  onlineUsers: Set<string>;
  currentRoom: string | null;
  loading: boolean;
  joinChatRoom: (roomId: string, otherUserId?: string | null) => void;
  sendMessage: (roomId: string, text: string) => void;
  sendTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  getMessageHistory: (roomId: string, limit?: number, before?: string | null) => void;
}