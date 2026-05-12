// ============================================
// SEARCH TYPES
// ============================================

// Search categories
export type SearchCategory = "all" | "users" | "posts" | "events";

// Connection status between current user and search result
export type ConnectionStatus =
  | "connected"
  | "pending_sent"
  | "pending_received"
  | "not_connected";

// ============================================
// SEARCH RESULT TYPES
// ============================================

// User search result
export interface UserSearchResult {
  _id: string;
  user: {
    _id: string;
    name: string;
    email?: string;
  };
  fullName: string;
  username: string;
  bio: string;
  major: string;
  year: string;
  campus: string;
  verified: boolean;
  profilePicture: string | null;
  connectionStatus: ConnectionStatus;
  type?: "user";
}

// Post search result
export interface PostSearchResult {
  _id: string;
  content: string;
  images: {
    filename: string;
    url: string;
    path: string;
    mimetype: string;
    size: number;
  }[];
  tags: string[];
  campus: string;
  visibility: "campus" | "connections";
  isAnonymous: boolean;
  isDeleted: boolean;
  user: {
    _id: string | null;
    name: string;
    username: string;
    email: string | null;
    verified: boolean;
    profilePicture: string | null;
  };
  originalUser?: {
    _id: string;
    name: string;
    username: string;
  };
  likes: any[];
  likeCount?: number;
  isLiked: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  type?: "post";
}

// Event search result
export interface EventSearchResult {
  _id: string;
  title: string;
  description: string;
  category: string;
  location: string;
  campus: string;
  startDate: string;
  endDate: string;
  organizer: {
    _id: string;
    name: string;
    username?: string;
    profilePicture: string | null;
  };
  organizerName: string;
  interestedCount: number;
  rsvpCount: number;
  visibility: "campus" | "connections" | "public";
  maxAttendees: number | null;
  isOnline: boolean;
  meetingLink: string;
  status: "upcoming" | "ongoing" | "completed" | "cancelled";
  tags: string[];
  coverImage: string | null;
  imageCount: number;
  isFull: boolean;
  type?: "event";
}

// ============================================
// API RESPONSE TYPES
// ============================================

// Pagination metadata
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// Search metadata
export interface SearchMeta {
  query: string;
  campus?: string | null;
  major?: string | null;
  year?: string | null;
  category?: string | null;
  status?: string | null;
  type?: string;
}

// User search API response
export interface UserSearchResponse {
  success: boolean;
  data: {
    users: UserSearchResult[];
    pagination: PaginationMeta;
    searchMeta: SearchMeta;
  };
  message?: string;
}

// Post search API response
export interface PostSearchResponse {
  success: boolean;
  data: {
    posts: PostSearchResult[];
    pagination: PaginationMeta;
    searchMeta: SearchMeta;
  };
  message?: string;
}

// Event search API response
export interface EventSearchResponse {
  success: boolean;
  data: {
    events: EventSearchResult[];
    pagination: PaginationMeta;
    searchMeta: SearchMeta;
  };
  message?: string;
}

// Unified search API response
export interface UnifiedSearchResponse {
  success: boolean;
  data: {
    users: UserSearchResult[];
    posts: Pick<PostSearchResult, "_id" | "content" | "createdAt">[];
    events: Pick<EventSearchResult, "_id" | "title" | "startDate" | "category">[];
  };
  searchMeta: SearchMeta;
  message?: string;
}

// ============================================
// SEARCH STATE TYPES
// ============================================

// Search filters
export interface SearchFilters {
  campus?: string;
  major?: string;
  year?: string;
  category?: string;
  status?: string;
  type?: "caption" | "tags";
}

// Recent search item (stored locally)
export interface RecentSearch {
  id: string;
  query: string;
  type: SearchCategory;
  timestamp: number;
}

// Trending search item (from server or static)
export interface TrendingSearch {
  id: string;
  query: string;
  type: SearchCategory;
  count?: number;
}

// Search state for the main search screen
export interface SearchState {
  query: string;
  activeCategory: SearchCategory;
  isSearching: boolean;
  // Results
  userResults: UserSearchResult[];
  postResults: PostSearchResult[];
  eventResults: EventSearchResult[];
  // Pagination per category
  userPagination: PaginationMeta | null;
  postPagination: PaginationMeta | null;
  eventPagination: PaginationMeta | null;
  // Loading states
  loadingUsers: boolean;
  loadingPosts: boolean;
  loadingEvents: boolean;
  // Error states
  error: string | null;
  // Recent & trending
  recentSearches: RecentSearch[];
  trendingSearches: TrendingSearch[];
  // Has user typed anything
  hasSearched: boolean;
}