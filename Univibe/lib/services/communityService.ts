// lib/services/communityService.ts

import { API_BASE_URL } from "@/constants/ipConstants";
import * as SecureStore from "expo-secure-store";
import {
  CommunitiesResponse,
  CommunityResponse,
  CommunityFeedResponse,
  MembersResponse,
  JoinRequestsResponse,
  PendingCommunitiesResponse,
  PendingCountResponse,
  ApprovalStatsResponse,
  MessageResponse,
  CreateCommunityPayload,
  UpdateCommunityPayload,
  HandleJoinRequestPayload,
} from "../types/community";

const BASE_URL = API_BASE_URL;

// ============================================
// HELPERS
// ============================================

const getToken = async (): Promise<string | null> => {
  return await SecureStore.getItemAsync("authToken");
};

const handleUnauthorized = async (): Promise<{
  success: boolean;
  message: string;
}> => {
  await SecureStore.deleteItemAsync("authToken");
  return { success: false, message: "Session expired. Please login again." };
};

export const getFullImageUrl = (url: string | null | undefined): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const baseUrl = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${baseUrl}${cleanPath}`;
};

// ============================================
// USER COMMUNITY SERVICE
// ============================================

export const communityService = {
  // ============================================
  // CREATE & MANAGE
  // ============================================

  createCommunity: async (
    payload: CreateCommunityPayload,
  ): Promise<CommunityResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const formData = new FormData();
    formData.append("name", payload.name);
    if (payload.description)
      formData.append("description", payload.description);
    formData.append("university", payload.university);
    formData.append("type", payload.type);
    if (payload.type === "department") {
      formData.append("privacy", "private");
    } else if (payload.privacy) {
      formData.append("privacy", payload.privacy);
    }
    if (payload.tags?.length)
      formData.append("tags", JSON.stringify(payload.tags));
    if (payload.rules?.length)
      formData.append("rules", JSON.stringify(payload.rules));
    if (payload.coverImage)
      formData.append("coverImage", payload.coverImage as any);

    const res = await fetch(`${BASE_URL}/api/communities`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  updateCommunity: async (
    communityId: string,
    payload: UpdateCommunityPayload,
  ): Promise<CommunityResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const formData = new FormData();
    if (payload.name) formData.append("name", payload.name);
    if (payload.description !== undefined)
      formData.append("description", payload.description);
    // ✅ Always append privacy as a string
    if (payload.privacy) formData.append("privacy", payload.privacy);
    if (payload.tags) formData.append("tags", JSON.stringify(payload.tags));
    if (payload.rules) formData.append("rules", JSON.stringify(payload.rules));
    if (payload.coverImage)
      formData.append("coverImage", payload.coverImage as any);

    const res = await fetch(`${BASE_URL}/api/communities/${communityId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  // ============================================
  // BROWSE & SEARCH
  // ============================================

  getCommunities: async (params?: {
    type?: string;
    privacy?: string;
  }): Promise<CommunitiesResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    let url = `${BASE_URL}/api/communities`;
    if (params) {
      const queryParams = new URLSearchParams();
      if (params.type) queryParams.append("type", params.type);
      if (params.privacy) queryParams.append("privacy", params.privacy);
      if (queryParams.toString()) url += `?${queryParams.toString()}`;
    }
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  getMyCommunities: async (): Promise<CommunitiesResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/communities/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  getMyPendingCommunities: async (): Promise<CommunitiesResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/communities/my-pending`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  searchCommunities: async (params: {
    q?: string;
    type?: string;
    privacy?: string;
  }): Promise<CommunitiesResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const queryParams = new URLSearchParams();
    if (params.q) queryParams.append("q", params.q);
    if (params.type) queryParams.append("type", params.type);
    if (params.privacy) queryParams.append("privacy", params.privacy);

    const res = await fetch(
      `${BASE_URL}/api/communities/search?${queryParams.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  // ============================================
  // SINGLE COMMUNITY
  // ============================================

  getCommunity: async (id: string): Promise<CommunityResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/communities/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  // ============================================
  // JOIN / LEAVE
  // ============================================

  joinCommunity: async (id: string): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/communities/${id}/join`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  requestToJoin: async (id: string): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/communities/${id}/join-request`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  leaveCommunity: async (id: string): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/communities/${id}/leave`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  // ============================================
  // INVITATIONS
  // ============================================

  inviteUser: async (
    communityId: string,
    userId: string,
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${communityId}/invite`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  getMyInvitations: async (): Promise<{
    success: boolean;
    data: any[];
    count: number;
  }> => {
    const token = await getToken();
    if (!token) return { success: false, data: [], count: 0 };

    const res = await fetch(`${BASE_URL}/api/communities/invitations/my`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      await handleUnauthorized();
      return { success: false, data: [], count: 0 };
    }
    return res.json();
  },

  respondToInvitation: async (
    communityId: string,
    action: "accept" | "reject",
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${communityId}/invitations/respond`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  getCommunityInvitations: async (communityId: string): Promise<any> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${communityId}/invitations`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  handleInvitation: async (
    communityId: string,
    invitationId: string,
    action: "approve" | "reject",
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${communityId}/invitations/${invitationId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  // ============================================
  // JOIN REQUEST MANAGEMENT
  // ============================================

  getJoinRequests: async (id: string): Promise<JoinRequestsResponse> => {
    const token = await getToken();
    if (!token)
      return { success: false, message: "Authentication required", data: null };

    const res = await fetch(`${BASE_URL}/api/communities/${id}/join-requests`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  handleJoinRequest: async (
    communityId: string,
    userId: string,
    payload: HandleJoinRequestPayload,
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${communityId}/join-requests/${userId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  // ============================================
  // MEMBER MANAGEMENT
  // ============================================

  getMembers: async (id: string, search?: string): Promise<MembersResponse> => {
    const token = await getToken();
    if (!token)
      return { success: false, message: "Authentication required", data: [] };

    let url = `${BASE_URL}/api/communities/${id}/members`;
    if (search) url += `?search=${encodeURIComponent(search)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  removeMember: async (
    communityId: string,
    userId: string,
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${communityId}/members/${userId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  addModerator: async (
    communityId: string,
    userId: string,
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${communityId}/moderators/${userId}`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  removeModerator: async (
    communityId: string,
    userId: string,
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${communityId}/moderators/${userId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  // ============================================
  // REPORT COMMUNITY
  // ============================================

  reportCommunity: async (
    communityId: string,
    reason: string,
  ): Promise<{ success: boolean; message?: string }> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/content/report/${communityId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reason, contentType: "Community" }),
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  // ============================================
  // CONTENT
  // ============================================

  getCommunityFeed: async (
    id: string,
    page = 1,
    limit = 20,
  ): Promise<CommunityFeedResponse> => {
    const token = await getToken();
    if (!token)
      return { success: false, message: "Authentication required", data: [] };

    const res = await fetch(
      `${BASE_URL}/api/communities/${id}/feed?page=${page}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  getCommunityEvents: async (
    id: string,
    page = 1,
    limit = 20,
  ): Promise<any> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/communities/${id}/events?page=${page}&limit=${limit}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },
};

// ============================================
// ADMIN COMMUNITY APPROVAL SERVICE
// ============================================

export const adminCommunityService = {
  getPendingCommunities: async (params?: {
    page?: number;
    limit?: number;
    type?: string;
    university?: string;
  }): Promise<PendingCommunitiesResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append("page", params.page.toString());
    if (params?.limit) queryParams.append("limit", params.limit.toString());
    if (params?.type) queryParams.append("type", params.type);
    if (params?.university) queryParams.append("university", params.university);

    const res = await fetch(
      `${BASE_URL}/api/admin/communities/pending?${queryParams.toString()}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  getPendingCount: async (): Promise<PendingCountResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/admin/communities/pending/count`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  getApprovalStats: async (): Promise<ApprovalStatsResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/admin/communities/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  getCommunityForReview: async (communityId: string): Promise<any> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/admin/communities/${communityId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  approveCommunity: async (
    communityId: string,
    notes?: string,
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/admin/communities/${communityId}/approve`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ notes }),
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  rejectCommunity: async (
    communityId: string,
    reason: string,
    allowResubmit?: boolean,
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(
      `${BASE_URL}/api/admin/communities/${communityId}/reject`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason, allowResubmit }),
      },
    );
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },

  bulkApproveCommunities: async (
    communityIds: string[],
    notes?: string,
  ): Promise<MessageResponse> => {
    const token = await getToken();
    if (!token) return { success: false, message: "Authentication required" };

    const res = await fetch(`${BASE_URL}/api/admin/communities/bulk-approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ communityIds, notes }),
    });
    if (res.status === 401) return handleUnauthorized();
    return res.json();
  },
};
