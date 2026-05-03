// lib/hooks/useFeed.ts
import { useState, useCallback, useRef, useEffect } from "react";
import {
  feedService,
  FeedResponse,
  PaginationInfo,
} from "../lib/services/feedService";
import { Post } from "../lib/services/postService";

export type FeedType = "campus" | "connections" | "anonymous";

interface FeedState {
  posts: Post[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  lastFetchedAt: number | null;
}

interface UseFeedReturn {
  activeFeed: FeedType;
  currentFeed: FeedState;
  allFeeds: Record<FeedType, FeedState>;
  switchFeed: (feedType: FeedType) => void;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  addNewPost: (post: Post) => void;
  removePost: (postId: string) => void;
  updatePost: (postId: string, updates: Partial<Post>) => void;
  refreshOnFocus: () => Promise<void>;
  forceRefresh: () => Promise<void>;
  markNeedsRefresh: () => void;
}

const REFRESH_COOLDOWN = 15 * 1000; // 15 seconds between refreshes
const FOCUS_REFRESH_INTERVAL = 5 * 1000; // 5 seconds minimum between focus refreshes

export function useFeed(): UseFeedReturn {
  const [activeFeed, setActiveFeed] = useState<FeedType>("campus");

  const initialFetchDone = useRef(false);
  const isFetching = useRef(false);
  const isMounted = useRef(true);
  const needsRefresh = useRef(false);

  const cursors = useRef<Record<FeedType, string | null>>({
    campus: null,
    connections: null,
    anonymous: null,
  });

  const pagination = useRef<Record<FeedType, PaginationInfo>>({
    campus: { hasMore: true, nextCursor: null, limit: 10 },
    connections: { hasMore: true, nextCursor: null, limit: 10 },
    anonymous: { hasMore: true, nextCursor: null, limit: 10 },
  });

  const lastRefreshTime = useRef<Record<FeedType, number>>({
    campus: 0,
    connections: 0,
    anonymous: 0,
  });

  const [feeds, setFeeds] = useState<Record<FeedType, FeedState>>({
    campus: createInitialState(),
    connections: createInitialState(),
    anonymous: createInitialState(),
  });

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Initial fetch - runs once on mount
  useEffect(() => {
    if (!initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchFeed("campus", "initial");
    }
  }, []);

  function createInitialState(): FeedState {
    return {
      posts: [],
      loading: false,
      refreshing: false,
      loadingMore: false,
      hasMore: true,
      error: null,
      lastFetchedAt: null,
    };
  }

  const fetchFeed = useCallback(
    async (
      feedType: FeedType,
      mode: "initial" | "refresh" | "loadMore" = "initial",
    ) => {
      // Prevent concurrent fetches
      if (isFetching.current) {
        return;
      }

      const currentState = feeds[feedType];

      // Guard: Don't load more if already loading or no more
      if (
        mode === "loadMore" &&
        (currentState.loadingMore || !currentState.hasMore)
      ) {
        return;
      }

      // Guard: Don't refresh if already refreshing
      if (mode === "refresh" && currentState.refreshing) {
        return;
      }

      // Guard: Don't initial fetch if already have data
      if (
        mode === "initial" &&
        currentState.posts.length > 0 &&
        !needsRefresh.current
      ) {
        return;
      }

      needsRefresh.current = false;
      isFetching.current = true;

      setFeeds((prev) => ({
        ...prev,
        [feedType]: {
          ...prev[feedType],
          loading: mode === "initial" && prev[feedType].posts.length === 0,
          refreshing: mode === "refresh",
          loadingMore: mode === "loadMore",
          error: null,
        },
      }));

      try {
        let response: FeedResponse;

        if (mode === "refresh" || mode === "initial") {
          // Fetch first page (no cursor)
          switch (feedType) {
            case "campus":
              response = await feedService.getCampusFeed();
              break;
            case "connections":
              response = await feedService.getConnectionsFeed();
              break;
            case "anonymous":
              response = await feedService.getAnonymousFeed();
              break;
            default:
              isFetching.current = false;
              return;
          }

          if (!isMounted.current) {
            isFetching.current = false;
            return;
          }

          cursors.current[feedType] = response.pagination.nextCursor;
          pagination.current[feedType] = response.pagination;
          lastRefreshTime.current[feedType] = Date.now();

          setFeeds((prev) => ({
            ...prev,
            [feedType]: {
              posts: response.posts,
              loading: false,
              refreshing: false,
              loadingMore: false,
              hasMore: response.pagination.hasMore,
              error: null,
              lastFetchedAt: Date.now(),
            },
          }));
        } else if (mode === "loadMore") {
          const cursor = cursors.current[feedType];

          if (!cursor) {
            setFeeds((prev) => ({
              ...prev,
              [feedType]: {
                ...prev[feedType],
                hasMore: false,
                loadingMore: false,
              },
            }));
            isFetching.current = false;
            return;
          }

          switch (feedType) {
            case "campus":
              response = await feedService.getMoreCampusFeed(cursor);
              break;
            case "connections":
              response = await feedService.getMoreConnectionsFeed(cursor);
              break;
            case "anonymous":
              response = await feedService.getMoreAnonymousFeed(cursor);
              break;
            default:
              isFetching.current = false;
              return;
          }

          if (!isMounted.current) {
            isFetching.current = false;
            return;
          }

          cursors.current[feedType] = response.pagination.nextCursor;
          pagination.current[feedType] = response.pagination;

          setFeeds((prev) => {
            const existingIds = new Set(prev[feedType].posts.map((p) => p._id));
            const newPosts = response.posts.filter(
              (p) => !existingIds.has(p._id),
            );

            return {
              ...prev,
              [feedType]: {
                posts: [...prev[feedType].posts, ...newPosts],
                loading: false,
                refreshing: false,
                loadingMore: false,
                hasMore: response.pagination.hasMore,
                error: null,
                lastFetchedAt: Date.now(),
              },
            };
          });
        }
      } catch (error: any) {
        console.error(`❌ Error fetching ${feedType} feed:`, error);

        if (!isMounted.current) {
          isFetching.current = false;
          return;
        }

        setFeeds((prev) => ({
          ...prev,
          [feedType]: {
            ...prev[feedType],
            loading: false,
            refreshing: false,
            loadingMore: false,
            error: error.message || "Failed to fetch feed",
          },
        }));
      } finally {
        isFetching.current = false;
      }
    },
    [feeds],
  );

  const switchFeed = useCallback(
    (feedType: FeedType) => {
      setActiveFeed(feedType);

      const feedState = feeds[feedType];
      if (
        feedState.posts.length === 0 &&
        !feedState.loading &&
        !feedState.refreshing
      ) {
        fetchFeed(feedType, "initial");
      }
    },
    [feeds, fetchFeed],
  );

  // Pull-to-refresh (respects cooldown)
  const refresh = useCallback(async () => {
    const now = Date.now();
    const lastTime = lastRefreshTime.current[activeFeed];

    if (now - lastTime < REFRESH_COOLDOWN) {
      // Briefly show refreshing state for UX
      setFeeds((prev) => ({
        ...prev,
        [activeFeed]: {
          ...prev[activeFeed],
          refreshing: true,
        },
      }));

      setTimeout(() => {
        if (isMounted.current) {
          setFeeds((prev) => ({
            ...prev,
            [activeFeed]: {
              ...prev[activeFeed],
              refreshing: false,
            },
          }));
        }
      }, 500);
      return;
    }

    cursors.current[activeFeed] = null;
    pagination.current[activeFeed] = {
      hasMore: true,
      nextCursor: null,
      limit: 10,
    };
    await feedService.invalidateFeedCache(activeFeed);
    await fetchFeed(activeFeed, "refresh");
  }, [activeFeed, fetchFeed]);

  const loadMore = useCallback(async () => {
    const currentState = feeds[activeFeed];
    if (
      currentState.loadingMore ||
      currentState.refreshing ||
      !currentState.hasMore
    ) {
      return;
    }
    await fetchFeed(activeFeed, "loadMore");
  }, [activeFeed, feeds, fetchFeed]);

  // Optimistic add new post to relevant feeds
  const addNewPost = useCallback((post: Post) => {
    feedService.invalidateCache();

    setFeeds((prev) => {
      const updated = { ...prev };

      // Campus feed: campus posts + anonymous posts
      if (post.visibility === "campus" || post.isAnonymous) {
        updated.campus = {
          ...updated.campus,
          posts: [post, ...updated.campus.posts],
        };
      }

      // Connections feed: connections visibility posts
      if (post.visibility === "connections") {
        updated.connections = {
          ...updated.connections,
          posts: [post, ...updated.connections.posts],
        };
      }

      // Anonymous feed: anonymous posts only
      if (post.isAnonymous) {
        updated.anonymous = {
          ...updated.anonymous,
          posts: [post, ...updated.anonymous.posts],
        };
      }

      return updated;
    });
  }, []);

  const removePost = useCallback((postId: string) => {
    feedService.invalidateCache();

    setFeeds((prev) => {
      const updated = { ...prev };
      (Object.keys(updated) as FeedType[]).forEach((feedType) => {
        updated[feedType] = {
          ...updated[feedType],
          posts: updated[feedType].posts.filter((p) => p._id !== postId),
        };
      });
      return updated;
    });
  }, []);

  const updatePost = useCallback((postId: string, updates: Partial<Post>) => {
    setFeeds((prev) => {
      const updated = { ...prev };
      (Object.keys(updated) as FeedType[]).forEach((feedType) => {
        updated[feedType] = {
          ...updated[feedType],
          posts: updated[feedType].posts.map((p) =>
            p._id === postId ? { ...p, ...updates } : p,
          ),
        };
      });
      return updated;
    });
  }, []);

  // Light refresh when screen gains focus (respects interval)
  const refreshOnFocus = useCallback(async () => {
    const now = Date.now();
    const lastTime = lastRefreshTime.current[activeFeed];

    // Only refresh if it's been more than FOCUS_REFRESH_INTERVAL
    if (now - lastTime > FOCUS_REFRESH_INTERVAL) {
      console.log("🔄 Refreshing feed on focus");
      cursors.current[activeFeed] = null;
      pagination.current[activeFeed] = {
        hasMore: true,
        nextCursor: null,
        limit: 10,
      };
      await feedService.invalidateFeedCache(activeFeed);
      await fetchFeed(activeFeed, "refresh");
    } else {
      console.log("⏭️ Skipping focus refresh - recently fetched");
    }
  }, [activeFeed, fetchFeed]);

  // Force refresh (bypasses cooldown completely)
  const forceRefresh = useCallback(async () => {
    console.log("💪 Force refreshing feed");
    cursors.current[activeFeed] = null;
    pagination.current[activeFeed] = {
      hasMore: true,
      nextCursor: null,
      limit: 10,
    };
    lastRefreshTime.current[activeFeed] = 0; // Reset cooldown
    await feedService.invalidateCache();
    await fetchFeed(activeFeed, "refresh");
  }, [activeFeed, fetchFeed]);

  // Mark that feed needs refresh (for use after creating posts)
  const markNeedsRefresh = useCallback(() => {
    console.log("🏷️ Marked feed as needing refresh");
    needsRefresh.current = true;
  }, []);

  return {
    activeFeed,
    currentFeed: feeds[activeFeed],
    allFeeds: feeds,
    switchFeed,
    refresh,
    loadMore,
    addNewPost,
    removePost,
    updatePost,
    refreshOnFocus,
    forceRefresh,
    markNeedsRefresh,
  };
}
