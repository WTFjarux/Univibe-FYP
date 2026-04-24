// lib/types/chat.types.ts
// ============================================
// ALL CHAT TYPES - SINGLE SOURCE OF TRUTH
// ============================================

// ============================================
// CORE DATA TYPES
// ============================================

export interface ChatRoom {
  roomId: string;
  type: 'direct' | 'group';
  name: string;
  avatar?: string | null;
  otherUserId?: string | null;
  otherUserAvatar?: string | null;
  participants: string[];
  lastMessage: LastMessagePreview | null;
  updatedAt: string;
  createdAt: string;
  isPinned: boolean;
  isMuted: boolean;
  muteUntil?: string | null;
}

export interface LastMessagePreview {
  message: string;
  sentAt: string;
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';
  readBy: string[];
}

export interface Message {
  _id: string;
  sender: string | { _id: string; name: string; avatar?: string };
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  message: string;
  type: 'text' | 'image' | 'audio' | 'video' | 'file' | 'location';
  createdAt: string;
  status: 'sent' | 'delivered' | 'read' | 'sending';
  mediaUrl?: string;
  mediaSize?: number;
  mediaName?: string;
  mediaMimeType?: string;
  thumbnailUrl?: string;
  duration?: number;
  locationData?: { latitude: number; longitude: number; locationName: string };
  replyTo?: ReplyToData | null;
  reactions: Reaction[];
  tempId?: string;
}

export interface ReplyToData {
  messageId: string;
  message: string;
  senderName: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

export interface Reaction {
  userId: string;
  reaction: string;
  createdAt: string;
}

// ============================================
// CHAT SCREEN UI TYPES
// ============================================

export interface ReplyToState {
  _id: string;
  senderName: string;
  message: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

export interface PendingMessage {
  tempId: string;
  message: string;
  timestamp: number;
  type?: string;
  mediaUrl?: string;
  duration?: number;
  replyTo?: ReplyToData;
}

export interface AttachmentData {
  type: 'image' | 'video' | 'document' | 'location';
  uri?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
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
}

// ============================================
// SOCKET EVENT TYPES
// ============================================

export interface SocketMessageData {
  roomId: string;
  message: string;
  createdAt?: string;
  sender?: string | { _id: string; name: string };
  senderName?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
  replyTo?: ReplyToData;
}

export interface ReadReceiptData {
  roomId: string;
  userId: string;
  readAt?: string;
}

export interface MessageDeleteData {
  roomId: string;
  messageId: string;
  deletedBy: string;
}

export interface ReactionData {
  messageId: string;
  userId: string;
  reaction?: string;
  reactions?: Reaction[];
}

// ============================================
// UI STATE TYPES
// ============================================

export interface ItemLayout {
  y: number;
  height: number;
  pageX?: number;
  pageY?: number;
}

export interface ActiveRoomContextValue {
  activeRoomId: string | null;
  setActiveRoomId: (roomId: string | null) => void;
  clearActiveRoom: () => void;
}

// ============================================
// COMPONENT PROP TYPES
// ============================================

export interface ChatItemProps {
  item: ChatRoom;
  isSelected: boolean;
  highlightAnim: any | null;
  isHighlighted: boolean;
  itemScaleAnim: any;
  itemTranslateYAnim: any;
  onPress: () => void;
  onLongPress: (
    item: ChatRoom,
    layout: { y: number; height: number; pageX: number; pageY: number }
  ) => void;
  isUnread?: boolean;
  currentUserId?: string;
  disableSelectedStyle?: boolean;
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
  currentUserId?: string;
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