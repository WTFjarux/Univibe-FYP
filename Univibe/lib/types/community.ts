// lib/types/community.ts

// ============================================
// BASE RESPONSE
// ============================================

export interface BaseResponse {
  success: boolean;
  message?: string;
}

// ============================================
// ENUMS
// ============================================

export type CommunityType = "community" | "department";
export type PrivacyType = "public" | "private";
export type MemberRole = "member" | "moderator";
export type JoinRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "left"
  | "removed";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type InvitationStatus = "pending" | "approved" | "rejected" | "accepted";

// ============================================
// COMMUNITY MEMBER
// ============================================

export interface CommunityMember {
  user: {
    _id: string;
    name: string;
    username: string;
    profilePicture: string | null;
  };
  joinedAt: string;
  role: MemberRole;
  isAdmin?: boolean;
}

// ============================================
// JOIN REQUEST
// ============================================

export interface JoinRequest {
  _id: string;
  user: {
    _id: string;
    name: string;
    username: string;
    email?: string;
    profilePicture: string | null;
  };
  requestedAt: string;
  status: JoinRequestStatus;
  processedBy?: {
    _id: string;
    name: string;
    username: string;
  };
  processedAt?: string;
  rejectionReason?: string;
}

// ============================================
// INVITATION
// ============================================

export interface Invitation {
  _id: string;
  user: {
    _id: string;
    name: string;
    username: string;
    email?: string;
    profilePicture: string | null;
  };
  invitedBy: {
    _id: string;
    name: string;
    username: string;
  };
  status: InvitationStatus;
  invitedAt: string;
  processedBy?: string;
  processedAt?: string;
}

// ============================================
// COMMUNITY RULE
// ============================================

export interface CommunityRule {
  title: string;
  description: string;
}

// ============================================
// COMMUNITY
// ============================================

export interface Community {
  _id: string;
  name: string;
  description: string;
  coverImage: string | null;
  university: string;
  type: CommunityType;
  privacy: PrivacyType;
  approvalStatus: ApprovalStatus;
  approvedBy?: { _id: string; name: string; username: string };
  approvedAt?: string;
  rejectionReason?: string;
  admins: {
    _id: string;
    name: string;
    username: string;
    profilePicture: string | null;
  }[];
  members: CommunityMember[];
  memberCount: number;
  joinRequests?: JoinRequest[];
  invitations?: Invitation[];
  tags: string[];
  rules: CommunityRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  isMember?: boolean;
  isAdmin?: boolean;
  isModerator?: boolean;
  hasPendingRequest?: boolean;
  requestStatus?: JoinRequestStatus | null;
  invitationStatus?: InvitationStatus | null;
  pendingRequestsCount?: number;
  pendingInvitationsCount?: number;
}

// ============================================
// APPROVAL QUEUE ITEM
// ============================================

export interface ApprovalQueueItem {
  _id: string;
  contentType: "community" | "department";
  contentId: string;
  contentModel: "Community";
  submittedBy: {
    _id: string;
    name: string;
    username: string;
    email?: string;
    profilePicture: string | null;
  };
  contentSnapshot: {
    name: string;
    description: string;
    type: CommunityType;
    privacy: PrivacyType;
    university: string;
    coverImage: string | null;
    memberCount: number;
  };
  status: ApprovalStatus;
  priority: "low" | "normal" | "high" | "urgent";
  reviewedBy?: { _id: string; name: string; username: string };
  reviewedAt?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  resubmissionAllowed: boolean;
  createdAt: string;
}

// ============================================
// MY INVITATION
// ============================================

export interface MyInvitation {
  _id: string;
  community: {
    _id: string;
    name: string;
    description: string;
    coverImage: string | null;
    type: CommunityType;
    privacy: PrivacyType;
    memberCount: number;
  };
  invitedBy: { _id: string; name: string; username: string };
  invitedAt: string;
  status: InvitationStatus;
}

// ============================================
// API RESPONSES - All extend BaseResponse
// ============================================

export interface CommunitiesResponse extends BaseResponse {
  data?: Community[];
  count?: number;
}

export interface CommunityResponse extends BaseResponse {
  data?: Community;
}

export interface CommunityFeedResponse extends BaseResponse {
  data?: any[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface MembersResponse extends BaseResponse {
  data?: CommunityMember[];
  count?: number;
}

export interface JoinRequestsResponse extends BaseResponse {
  data?: {
    pending: JoinRequest[];
    processed: JoinRequest[];
    pendingCount: number;
    totalCount: number;
  } | null;
}

export interface InvitationsResponse extends BaseResponse {
  data?: {
    pending: Invitation[];
    processed: Invitation[];
    pendingCount: number;
  };
}

export interface MyInvitationsResponse extends BaseResponse {
  data?: MyInvitation[];
  count?: number;
}

export interface PendingCommunitiesResponse extends BaseResponse {
  data?: ApprovalQueueItem[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PendingCountResponse extends BaseResponse {
  data?: { pending: number };
}

export interface ApprovalStatsResponse extends BaseResponse {
  data?: {
    total: number;
    pending: { total: number; community: number; department: number };
    approved: { total: number; community: number; department: number };
    rejected: { total: number; community: number; department: number };
  };
}

export interface MessageResponse extends BaseResponse {
  data?: any;
}

// ============================================
// PAYLOADS
// ============================================

export interface CreateCommunityPayload {
  name: string;
  description?: string;
  university: string;
  type: CommunityType;
  privacy?: PrivacyType;
  tags?: string[];
  rules?: CommunityRule[];
  coverImage?: File | null;
}

export interface UpdateCommunityPayload {
  name?: string;
  description?: string;
  tags?: string[];
  privacy?: PrivacyType;
  rules?: CommunityRule[];
  coverImage?: File | null;
}

export interface HandleJoinRequestPayload {
  action: "approve" | "reject";
  reason?: string;
}

export interface InviteUserPayload {
  userId: string;
}

export interface RespondToInvitationPayload {
  action: "accept" | "reject";
}

export interface HandleInvitationPayload {
  action: "approve" | "reject";
}
