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
  groupIcon?: string | null;
  groupPhoto?: string | null;
  groupDescription?: string;
  otherUserId?: string | null;
  otherUserAvatar?: string | null;
  participants: string[] | GroupParticipant[];
  participantCount?: number;
  lastMessage: LastMessagePreview | null;
  updatedAt: string;
  createdAt: string;
  isPinned: boolean;
  isMuted: boolean;
  muteUntil?: string | null;
  isCleared?: boolean;
  clearedAt?: string | null;
  groupSettings?: GroupSettings;
  createdBy?: string;
  unreadCount?: number; // 🆕 Added
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
  sharedPost?: SharedPostData; // 🆕 Added
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

// 🆕 Added
export interface SharedPostData {
  postId: string;
  postContent: string;
  postImage: string;
  postAuthorId: string;
  postAuthorName: string;
  postAuthorUsername: string;
  postAuthorAvatar: string;
  isAnonymous: boolean;
  postCreatedAt: string;
}

// ============================================
// GROUP TYPES
// ============================================

export interface GroupSettings {
  onlyAdminsCanSend: boolean;
  onlyAdminsCanAddMembers: boolean;
  onlyAdminsCanChangeInfo: boolean;
  muteNotifications: boolean;
}

export interface GroupParticipant {
  userId: string;
  name: string;
  username: string;
  avatar?: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  lastReadAt: string;
}

export interface GroupInfo {
  roomId: string;
  name: string;
  groupIcon?: string;
  groupDescription?: string;
  participantCount: number;
  participants: GroupParticipant[];
  groupSettings?: GroupSettings;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// GROUP SOCKET EVENT TYPES
// ============================================

export interface GroupCreatedData {
  roomId: string;
  groupName: string;
  participantCount: number;
}

export interface AddedToGroupData {
  roomId: string;
  groupName: string;
  addedBy: string;
  participantCount?: number;
}

export interface RemovedFromGroupData {
  roomId: string;
  groupName: string;
  removedBy: string;
}

export interface GroupMembersAddedData {
  roomId: string;
  newMembers: string[];
  addedBy: string;
  timestamp: string;
}

export interface GroupMemberRemovedData {
  roomId: string;
  removedMember: string;
  removedBy: string;
  timestamp: string;
}

export interface GroupMemberLeftData {
  roomId: string;
  userId: string;
  timestamp: string;
}

export interface GroupUpdatedData {
  roomId: string;
  name?: string;
  icon?: string;
  description?: string;
  settings?: GroupSettings;
  updatedBy: string;
  timestamp?: string;
}

export interface GroupRoleChangedData {
  roomId: string;
  userId: string;
  newRole: "admin" | "member";
  changedBy: string;
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

export type AttachmentType =
  | "image"
  | "video"
  | "file"
  | "document"
  | "location"
  | "audio";

export interface AttachmentData {
  type: AttachmentType;
  uri?: string;
  name?: string;
  size?: number;
  mimeType?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
}

export interface ProcessedAttachment extends AttachmentData {
  needsCompression?: boolean;
  originalSize?: number;
  videoWidth?: number;
  videoHeight?: number;
  thumbnailUri?: string;
  duration?: number;
}

export interface VideoProcessingState {
  visible: boolean;
  progress: number;
  message: string;
  videoName: string;
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
    roomType?: string; 
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


export interface GroupResponse {
  success: boolean;
  message?: string;
  data?: {
    roomId: string;
    name: string;
    groupIcon?: string;
    groupDescription?: string;
    participantCount: number;
    participants: GroupParticipant[];
    groupSettings?: GroupSettings;
    createdBy: string;
    createdAt: string;
  };
}


export interface GroupMembersResponse {
  success: boolean;
  data?: GroupParticipant[];
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
  timestamp?: Date;
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


export interface TypingData {
  userId: string;
  userName: string;
  roomId: string;
  activeTypersCount?: number;
  activeTypers?: Array<{ userId: string; userName: string }>;
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

export interface ChatHeaderProps {
  otherUserName: string;
  otherUserId: string;
  otherUserAvatar?: string;
  isOnline: boolean;
  DEFAULT_AVATAR: any;
  getFullImageUrl: (url: string) => string;
  isGroup?: boolean;
  participantCount?: number;
  onGroupInfoPress?: () => void;
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
