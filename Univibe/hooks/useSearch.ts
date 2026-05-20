import { useState, useCallback, useRef, useEffect } from "react"; // Added useEffect
import { useDebounce } from "./useDebounce";
import { useRecentSearches } from "./useRecentSearches";
import {
  searchUsers,
  searchPosts,
  searchEvents,
} from "../lib/services/searchService";
import {
  SearchCategory,
  SearchFilters,
  UserSearchResult,
  PostSearchResult,
  EventSearchResult,
  PaginationMeta,
} from "../lib/types/search";

interface UseSearchReturn {
  // State
  query: string;
  debouncedQuery: string;
  activeCategory: SearchCategory;
  isSearching: boolean;
  userResults: UserSearchResult[];
  postResults: PostSearchResult[];
  eventResults: EventSearchResult[];
  userPagination: PaginationMeta | null;
  postPagination: PaginationMeta | null;
  eventPagination: PaginationMeta | null;
  loadingUsers: boolean;
  loadingPosts: boolean;
  loadingEvents: boolean;
  error: string | null;
  hasSearched: boolean;

  // Recent searches
  recentSearches: ReturnType<typeof useRecentSearches>["recentSearches"];
  recentSearchesLoaded: ReturnType<typeof useRecentSearches>["loaded"];
  addRecentSearch: ReturnType<typeof useRecentSearches>["addRecentSearch"];
  removeRecentSearch: ReturnType<
    typeof useRecentSearches
  >["removeRecentSearch"];
  clearRecentSearches: ReturnType<
    typeof useRecentSearches
  >["clearRecentSearches"];

  // Actions
  setQuery: (query: string) => void;
  setActiveCategory: (category: SearchCategory) => void;
  performSearch: (
    category?: SearchCategory,
    searchQueryOverride?: string,
  ) => Promise<void>;
  loadMore: () => Promise<void>;
  clearResults: () => void;
}

/**
 * Main search hook that orchestrates all search functionality.
 *
 * Features:
 * - Debounced auto-search (300ms)
 * - Category-based results (all/users/posts/events)
 * - Pagination per category
 * - Recent searches management
 * - Loading/error states per category
 * - "All" tab shows unified results
 */
export function useSearch(): UseSearchReturn {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<SearchCategory>("all");
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Results per category
  const [userResults, setUserResults] = useState<UserSearchResult[]>([]);
  const [postResults, setPostResults] = useState<PostSearchResult[]>([]);
  const [eventResults, setEventResults] = useState<EventSearchResult[]>([]);

  // Pagination per category
  const [userPagination, setUserPagination] = useState<PaginationMeta | null>(
    null,
  );
  const [postPagination, setPostPagination] = useState<PaginationMeta | null>(
    null,
  );
  const [eventPagination, setEventPagination] = useState<PaginationMeta | null>(
    null,
  );

  // Loading states per category
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Debounce the query (300ms)
  const debouncedQuery = useDebounce(query, 300);

  // Recent searches
  const {
    recentSearches,
    loaded: recentSearchesLoaded,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useRecentSearches();

  // Track if a search is in progress to prevent duplicate requests
  const searchInProgress = useRef(false);

  // ✅ AUTO-SEARCH: Trigger search when debounced query changes
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      performSearch(activeCategory, debouncedQuery);
    } else if (debouncedQuery.trim().length === 0) {
      clearResults();
    }
  }, [debouncedQuery]); // Re-run when debounced query changes

  /**
   * Perform search for the current active category
   */
  const performSearch = useCallback(
    async (category?: SearchCategory, searchQueryOverride?: string) => {
      const searchCategory = category || activeCategory;
      const searchQuery = searchQueryOverride || debouncedQuery || query;

      if (!searchQuery.trim() || searchQuery.trim().length < 2) return;
      if (searchInProgress.current) return;

      searchInProgress.current = true;
      setIsSearching(true);
      setError(null);
      setHasSearched(true);

      try {
        // Set loading for the active category
        switch (searchCategory) {
          case "users":
            setLoadingUsers(true);
            break;
          case "posts":
            setLoadingPosts(true);
            break;
          case "events":
            setLoadingEvents(true);
            break;
          case "all":
            setLoadingUsers(true);
            setLoadingPosts(true);
            setLoadingEvents(true);
            break;
        }

        // Add to recent searches
        await addRecentSearch(searchQuery.trim(), searchCategory);

        // Fetch results based on category
        if (searchCategory === "users" || searchCategory === "all") {
          const userResponse = await searchUsers(searchQuery.trim(), 1, 20);
          setUserResults(userResponse.data.users);
          setUserPagination(userResponse.data.pagination);
        }

        if (searchCategory === "posts" || searchCategory === "all") {
          const postResponse = await searchPosts(searchQuery.trim(), 1, 10);
          setPostResults(postResponse.data.posts);
          setPostPagination(postResponse.data.pagination);
        }

        if (searchCategory === "events" || searchCategory === "all") {
          const eventResponse = await searchEvents(searchQuery.trim(), 1, 10);
          setEventResults(eventResponse.data.events);
          setEventPagination(eventResponse.data.pagination);
        }
      } catch (err: any) {
        console.error("Search error:", err);
        setError(err.message || "Failed to perform search");
      } finally {
        setLoadingUsers(false);
        setLoadingPosts(false);
        setLoadingEvents(false);
        setIsSearching(false);
        searchInProgress.current = false;
      }
    },
    [query, debouncedQuery, activeCategory, addRecentSearch],
  );

  /**
   * Load more results for the current category (pagination)
   */
  const loadMore = useCallback(async () => {
    const searchQuery = debouncedQuery || query;
    if (!searchQuery.trim() || searchInProgress.current) return;

    let pagination: PaginationMeta | null = null;
    let currentPage = 1;

    switch (activeCategory) {
      case "users":
        pagination = userPagination;
        currentPage = pagination?.page || 1;
        if (!pagination || currentPage >= pagination.pages) return;
        break;
      case "posts":
        pagination = postPagination;
        currentPage = pagination?.page || 1;
        if (!pagination || currentPage >= pagination.pages) return;
        break;
      case "events":
        pagination = eventPagination;
        currentPage = pagination?.page || 1;
        if (!pagination || currentPage >= pagination.pages) return;
        break;
      case "all":
        // "All" tab doesn't support pagination currently
        return;
    }

    searchInProgress.current = true;
    const nextPage = currentPage + 1;

    try {
      switch (activeCategory) {
        case "users":
          setLoadingUsers(true);
          const userResponse = await searchUsers(
            searchQuery.trim(),
            nextPage,
            20,
          );
          setUserResults((prev) => [...prev, ...userResponse.data.users]);
          setUserPagination(userResponse.data.pagination);
          setLoadingUsers(false);
          break;

        case "posts":
          setLoadingPosts(true);
          const postResponse = await searchPosts(
            searchQuery.trim(),
            nextPage,
            10,
          );
          setPostResults((prev) => [...prev, ...postResponse.data.posts]);
          setPostPagination(postResponse.data.pagination);
          setLoadingPosts(false);
          break;

        case "events":
          setLoadingEvents(true);
          const eventResponse = await searchEvents(
            searchQuery.trim(),
            nextPage,
            10,
          );
          setEventResults((prev) => [...prev, ...eventResponse.data.events]);
          setEventPagination(eventResponse.data.pagination);
          setLoadingEvents(false);
          break;
      }
    } catch (err: any) {
      console.error("Load more error:", err);
      setError(err.message || "Failed to load more results");
    } finally {
      searchInProgress.current = false;
    }
  }, [
    query,
    debouncedQuery,
    activeCategory,
    userPagination,
    postPagination,
    eventPagination,
  ]);

  /**
   * Clear all search results and reset state
   */
  const clearResults = useCallback(() => {
    setUserResults([]);
    setPostResults([]);
    setEventResults([]);
    setUserPagination(null);
    setPostPagination(null);
    setEventPagination(null);
    setError(null);
    setHasSearched(false);
  }, []);

  return {
    // State
    query,
    debouncedQuery,
    activeCategory,
    isSearching,
    userResults,
    postResults,
    eventResults,
    userPagination,
    postPagination,
    eventPagination,
    loadingUsers,
    loadingPosts,
    loadingEvents,
    error,
    hasSearched,

    // Recent searches
    recentSearches,
    recentSearchesLoaded,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,

    // Actions
    setQuery,
    setActiveCategory,
    performSearch,
    loadMore,
    clearResults,
  };
}
