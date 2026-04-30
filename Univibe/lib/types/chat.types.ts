// lib/types/chat.types.ts
// ============================================
// ALL CHAT TYPES - SINGLE SOURCE OF TRUTH
// ============================================

// ============================================
// CORE DATA TYPES
// ============================================

export interface ChatRoom {
  roomId: string;
  type: "direct" | "group";
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
  isCleared?: boolean; // Whether current user has cleared this chat
  clearedAt?: string | null; // Timestamp when chat was cleared
}

export interface LastMessagePreview {
  message: string;
  sentAt: string;
  senderId: string;
  senderName: string;
  type: "text" | "image" | "audio" | "video" | "file" | "location" | "post";
  readBy: string[];
}

export interface Message {
  _id: string;
  sender: string | { _id: string; name: string; avatar?: string };
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  message: string;
  type: "text" | "image" | "audio" | "video" | "file" | "location" | "post";
  createdAt: string;
  status: "sent" | "delivered" | "read" | "sending";
  readBy?: Array<{ user: string; readAt: string } | string>;
  deliveredTo?: Array<{ user: string; deliveredAt: string } | string>;
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
  groupId?: string;
  groupIndex?: number;
  groupTotal?: number;
  isForwarded?: boolean;
  originalMessageId?: string;
  originalSenderId?: string;
  originalSenderName?: string;
  forwardedAt?: string;
}

export interface ReplyToData {
  messageId: string;
  message: string;
  senderName: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
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
  thumbnailUrl?: string;
  duration?: number;
}

export interface PendingMessage {
  tempId: string;
  message: string;
  timestamp: number;
  type?: string;
  mediaUrl?: string;
  mediaName?: string;
  mediaSize?: number;
  duration?: number;
  replyTo?: ReplyToData;
  groupId?: string;
  groupIndex?: number;
  groupTotal?: number;
}

// ============================================
// ATTACHMENT TYPES
// ============================================

/**
 * All supported attachment types
 * Used for both input selection and processed attachments
 */
export type AttachmentType =
  | "image"
  | "video"
  | "file"
  | "document"
  | "location"
  | "audio";

/**
 * Raw attachment data from file picker or location share
 * Type is flexible as it may come from various sources
 */
export interface AttachmentData {
  type: AttachmentType;
  uri?: string;
  name?: string;
  size?: number;
  mimeType?: string;

  // Location specific
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

/**
 * Processed attachment ready for upload
 * Extends AttachmentData with processing metadata
 */
export interface ProcessedAttachment extends AttachmentData {
  /** Whether this attachment needs server-side compression */
  needsCompression?: boolean;

  /** Original file size before any processing (in bytes) */
  originalSize?: number;

  /** Video width in pixels (for compression hints) */
  videoWidth?: number;

  /** Video height in pixels (for compression hints) */
  videoHeight?: number;

  /** Local URI for video thumbnail preview */
  thumbnailUri?: string;

  /** Video/audio duration in seconds */
  duration?: number;
}

/**
 * Video processing progress state for UI
 */
export interface VideoProcessingState {
  /** Whether the processing modal is visible */
  visible: boolean;

  /** Progress percentage (0-100) */
  progress: number;

  /** Current status message */
  message: string;

  /** Name of the video being processed */
  videoName: string;

  /** Original file size display string */
  originalSize: string;
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
    clearedAt?: string | null;
    isCleared?: boolean;
  };
}

export interface DeleteChatHistoryResponse {
  success: boolean;
  message: string;
  roomId?: string;
  clearedAt?: string;
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

export interface ChatClearedData {
  roomId: string;
  success: boolean;
  clearedAt: string;
}

export interface ChatRestoredData {
  roomId: string;
  userId: string;
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
    layout: { y: number; height: number; pageX: number; pageY: number },
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
    type?: string,
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
