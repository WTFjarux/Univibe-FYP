// lib/socket.ts
export interface Message {
  _id?: string;
  messageId?: string;
  sender: string;
  senderName: string;
  senderAvatar?: string;
  roomId: string;
  message: string;
  type: "text" | "image" | "audio" | "video" | "file";
  replyTo?: string | null;
  readBy?: Array<{ userId: string; readAt: Date }>;
  isRead?: boolean;
  reactions?: Array<{ userId: string; reaction: string; createdAt: Date }>;
  isDeleted?: boolean;
  status?: "sent" | "delivered" | "read";
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ChatRoom {
  roomId: string;
  type: "direct" | "group";
  name?: string;
  description?: string;
  avatar?: string;
  participants: Array<{
    userId: string;
    joinedAt: Date;
    role: "member" | "admin" | "owner";
    lastReadAt: Date;
  }>;
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
  callType?: "audio" | "video";
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  timestamp?: Date;
}

export interface RoomEvent {
  roomId: string;
  success: boolean;
}

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
  settings?: any;
  updatedBy: string;
}

export interface GroupRoleChangedData {
  roomId: string;
  userId: string;
  newRole: "admin" | "member";
  changedBy: string;
}

export interface TypingData {
  userId: string;
  userName: string;
  roomId: string;
  activeTypersCount?: number;
  activeTypers?: Array<{ userId: string; userName: string }>;
}
