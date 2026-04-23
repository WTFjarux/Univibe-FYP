// lib/types/chat.ts

import { Animated } from "react-native";

// ============================================
// MESSAGE TYPES
// ============================================

export interface Message {
  _id?: string;
  messageId?: string;
  sender: string;
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  message: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file';
  mediaUrl?: string;
  mediaSize?: number;
  mediaName?: string;
  mediaMimeType?: string;
  duration?: number;
  isPlayed?: boolean;
  replyTo?: {
    messageId: string;
    message: string;
    senderName: string;
    senderId?: string;
    type?: string;
    mediaUrl?: string;
    duration?: number;
  } | null;
  
  // WhatsApp-level read receipts
  readBy: Array<{ user: string; readAt: Date }>;
  deliveredTo: Array<{ user: string; deliveredAt: Date }>;
  
  // Legacy support
  isRead?: boolean;
  
  reactions: Array<{ user: string; reaction: string; createdAt: Date }>;
  isDeleted?: boolean;
  deletedFor?: string[];
  status?: 'sent' | 'delivered' | 'read';
  createdAt?: Date;
  updatedAt?: Date;
  tempId?: string;
}

// ============================================
// CHAT ROOM TYPES
// ============================================

export interface ChatRoom {
  roomId: string;
  type: 'direct' | 'group';
  name: string;
  description?: string;
  avatar?: string;
  otherUserId?: string;
  otherUserAvatar?: string;
  participants: string[];
  
  // WhatsApp-level last message with readBy
  lastMessage?: {
    message: string;
    sentAt: string;
    senderId: string;
    senderName: string;
    type: string;
    readBy: string[];
  };
  
  messageCount: number;
  updatedAt: string;
  createdAt?: Date;
  
  // UI state
  isPinned?: boolean;
  isMuted?: boolean;
  isRead?: boolean; // Legacy support
}

// ============================================
// SOCKET EVENT TYPES
// ============================================

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
    avatar?: string;
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

// Read Receipt Events
export interface ReadReceiptEvent {
  roomId: string;
  userId: string;
  readAt?: Date;
}

export interface MessageReadEvent {
  messageId: string;
  roomId: string;
  userId: string;
  readAt?: Date;
}

export interface DeliveryConfirmationEvent {
  messageId: string;
  recipientId: string;
  deliveredAt?: Date;
}

// Reaction Events
export interface ReactionEvent {
  messageId: string;
  userId: string;
  reaction?: string;
  reactions?: Array<{ user: string; reaction: string; createdAt: Date }>;
}

// Delete Event
export interface DeleteMessageEvent {
  roomId: string;
  messageId: string;
  deletedBy: string;
  timestamp?: Date;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ChatRoomsResponse {
  success: boolean;
  data: ChatRoom[];
}

export interface SingleRoomResponse {
  success: boolean;
  data: ChatRoom;
}

export interface MessagesResponse {
  success: boolean;
  data: {
    roomId: string;
    messages: Message[];
    hasMore: boolean;
  };
}

export interface MarkReadResponse {
  success: boolean;
  message: string;
  modifiedCount: number;
  otherUserId?: string | null;
}

export interface UnreadCountResponse {
  success: boolean;
  data: {
    unreadCount: number;
  };
}

export interface AllUnreadCountsResponse {
  success: boolean;
  data: Record<string, number>;
}

// ============================================
// CONTEXT TYPES
// ============================================

export interface ChatContextType {
  isConnected: boolean;
  messages: Record<string, Message[]>;
  typingUsers: Record<string, Record<string, boolean>>;
  onlineUsers: Set<string>;
  currentRoom: string | null;
  loading: boolean;
  joinChatRoom: (roomId: string, otherUserId?: string | null) => void;
  sendMessage: (
    roomId: string, 
    text: string, 
    type?: string,
    replyTo?: Message['replyTo'],
    tempId?: string,
    mediaUrl?: string,
    duration?: number
  ) => void;
  sendTyping: (roomId: string) => void;
  stopTyping: (roomId: string) => void;
  getMessageHistory: (roomId: string, limit?: number, before?: string | null) => void;
  markRoomAsRead: (roomId: string) => void;
  markMessageAsRead: (messageId: string) => void;
  addReaction: (messageId: string, reaction: string) => void;
  removeReaction: (messageId: string) => void;
  deleteMessage: (messageId: string, roomId: string) => void;
}

// ============================================
// HOOK RETURN TYPES
// ============================================

export interface UseChatRoomsReturn {
  chatRooms: ChatRoom[];
  filteredRooms: ChatRoom[];
  loading: boolean;
  refreshing: boolean;
  searchQuery: string;
  setSearchQuery: (text: string) => void;
  fetchChatRooms: () => Promise<void>;
  onRefresh: () => void;
  refreshSingleRoom: (roomId: string) => Promise<void>;
  updateChatRoomLastMessage: (
    roomId: string,
    message: string,
    sentAt: string,
    senderId?: string,
    senderName?: string,
    type?: string
  ) => void;
  handleMessagesRead: (roomId: string, userId: string) => void;
  markRoomAsReadLocally: (roomId: string) => void;
  markRoomAsReadOnServer: (roomId: string) => Promise<void>;
  isRoomUnread: (room: ChatRoom) => boolean;
  pinChat: (room: ChatRoom | null) => void;
  toggleRead: (room: ChatRoom | null) => Promise<void>;
  toggleMute: (room: ChatRoom | null) => void;
  deleteChat: (room: ChatRoom | null, onSuccess?: () => void) => Promise<void>;
}

// ============================================
// ACTIVE ROOM TYPES
// ============================================

export interface ActiveRoomContextValue {
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  clearActiveRoom: () => void;
}

// ============================================
// SOCKET SERVICE TYPES
// ============================================

export interface ReplyToData {
  messageId: string;
  message: string;
  senderName: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

export type EventCallback = (data: any) => void;

// ============================================
// CHAT ITEM PROPS
// ============================================

export interface ChatItemProps {
  item: ChatRoom;
  isSelected: boolean;
  highlightAnim: Animated.Value | null;
  isHighlighted: boolean;
  itemScaleAnim: Animated.Value;
  itemTranslateYAnim: Animated.Value;
  onPress: () => void;
  onLongPress: (
    item: ChatRoom,
    layout: { y: number; height: number; pageX: number; pageY: number }
  ) => void;
  isUnread?: boolean;
}

// ============================================
// MODAL TYPES
// ============================================

export interface ItemLayout {
  y: number;
  height: number;
  pageX?: number;
  pageY?: number;
}

export interface ChatListOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  onPin: () => void;
  onToggleRead: () => void;
  onMute: () => void;
  onDelete: () => void;
  isPinned?: boolean;
  isMuted?: boolean;
  isRead?: boolean;
  item: ChatRoom | null;
  itemLayout?: ItemLayout;
}