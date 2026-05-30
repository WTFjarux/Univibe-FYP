// lib/hooks/useFeed.ts
import { useState, useCallback, useRef, useEffect } from "react";
import {
  feedService,
  FeedResponse,
  PaginationInfo,
} from "../lib/services/feedService";
import { Post } from "../lib/services/postService";
import { communityService } from "../lib/services/communityService";

export type FeedType = "campus" | "connections" | "anonymous" | "communities";

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
  invalidateAllFeeds: () => Promise<void>;
}

const REFRESH_COOLDOWN = 15 * 1000;
const FOCUS_REFRESH_INTERVAL = 5 * 1000;

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
    communities: null,
  });

  const pagination = useRef<Record<FeedType, PaginationInfo>>({
    campus: { hasMore: true, nextCursor: null, limit: 10 },
    connections: { hasMore: true, nextCursor: null, limit: 10 },
    anonymous: { hasMore: true, nextCursor: null, limit: 10 },
    communities: { hasMore: true, nextCursor: null, limit: 10 },
  });

  const lastRefreshTime = useRef<Record<FeedType, number>>({
    campus: 0,
    connections: 0,
    anonymous: 0,
    communities: 0,
  });

  const [feeds, setFeeds] = useState<Record<FeedType, FeedState>>({
    campus: createInitialState(),
    connections: createInitialState(),
    anonymous: createInitialState(),
    communities: createInitialState(),
  });

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

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

  // ===========================================================================
  // Fetch communities feed - combines posts from all joined communities
  // ===========================================================================
  const fetchCommunitiesFeed = useCallback(async (): Promise<FeedResponse> => {
    try {
      const myCommunities = await communityService.getMyCommunities();
      const communities = myCommunities.data || [];
      const communityIds = communities.map((c: any) => c._id);

      if (communityIds.length === 0) {
        return {
          success: true,
          posts: [],
          pagination: { hasMore: false, nextCursor: null, limit: 10 },
        };
      }

      // Fetch posts from each community
      const allPosts: Post[] = [];
      for (const communityId of communityIds) {
        try {
          const feed = await communityService.getCommunityFeed(
            communityId,
            1,
            10,
          );
          if (feed.success && feed.data) {
            allPosts.push(...feed.data);
          }
        } catch (error) {
          console.error(
            `Error fetching feed for community ${communityId}:`,
            error,
          );
        }
      }

      // Sort by newest first
      allPosts.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      return {
        success: true,
        posts: allPosts,
        pagination: { hasMore: false, nextCursor: null, limit: 10 },
      };
    } catch (error) {
      console.error("fetchCommunitiesFeed error:", error);
      return {
        success: true,
        posts: [],
        pagination: { hasMore: false, nextCursor: null, limit: 10 },
      };
    }
  }, []);

  // ===========================================================================
  // Silent fetch
  // ===========================================================================
  const fetchFeedSilent = useCallback(
    async (feedType: FeedType) => {
      if (isFetching.current) return;
      isFetching.current = true;

      try {
        let response: FeedResponse;

        if (feedType === "communities") {
          response = await fetchCommunitiesFeed();
        } else {
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
            ...prev[feedType],
            posts: response.posts,
            hasMore: response.pagination.hasMore,
            error: null,
            lastFetchedAt: Date.now(),
            loading: false,
            refreshing: false,
            loadingMore: false,
          },
        }));
      } catch (error: any) {
        console.error(`Error silent fetching ${feedType} feed:`, error);
      } finally {
        isFetching.current = false;
      }
    },
    [fetchCommunitiesFeed],
  );

  // ===========================================================================
  // Invalidate all feeds
  // ===========================================================================
  const invalidateAllFeeds = useCallback(async () => {
    await feedService.invalidateCache();

    cursors.current = {
      campus: null,
      connections: null,
      anonymous: null,
      communities: null,
    };

    pagination.current = {
      campus: { hasMore: true, nextCursor: null, limit: 10 },
      connections: { hasMore: true, nextCursor: null, limit: 10 },
      anonymous: { hasMore: true, nextCursor: null, limit: 10 },
      communities: { hasMore: true, nextCursor: null, limit: 10 },
    };

    needsRefresh.current = true;

    lastRefreshTime.current = {
      campus: 0,
      connections: 0,
      anonymous: 0,
      communities: 0,
    };

    if (activeFeed) {
      await fetchFeedSilent(activeFeed);
    }
  }, [activeFeed, fetchFeedSilent]);

  // ===========================================================================
  // Normal fetch
  // ===========================================================================
  const fetchFeed = useCallback(
    async (
      feedType: FeedType,
      mode: "initial" | "refresh" | "loadMore" = "initial",
    ) => {
      if (isFetching.current) return;

      const currentState = feeds[feedType];

      if (
        mode === "loadMore" &&
        (currentState.loadingMore || !currentState.hasMore)
      )
        return;
      if (mode === "refresh" && currentState.refreshing) return;
      if (
        mode === "initial" &&
        currentState.posts.length > 0 &&
        !needsRefresh.current
      )
        return;

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
          if (feedType === "communities") {
            response = await fetchCommunitiesFeed();
          } else {
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
          // Communities doesn't support cursor pagination
          if (feedType === "communities") {
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
        console.error(`Error fetching ${feedType} feed:`, error);
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
    [feeds, fetchCommunitiesFeed],
  );

  // ===========================================================================
  // Public API
  // ===========================================================================
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

  const refresh = useCallback(async () => {
    const now = Date.now();
    const lastTime = lastRefreshTime.current[activeFeed];
    if (now - lastTime < REFRESH_COOLDOWN) return;

    cursors.current[activeFeed] = null;
    pagination.current[activeFeed] = {
      hasMore: true,
      nextCursor: null,
      limit: 10,
    };
    if (activeFeed !== "communities") {
      await feedService.invalidateFeedCache(activeFeed as any);
    }
    await fetchFeed(activeFeed, "refresh");
  }, [activeFeed, fetchFeed]);

  const loadMore = useCallback(async () => {
    const currentState = feeds[activeFeed];
    if (
      currentState.loadingMore ||
      currentState.refreshing ||
      !currentState.hasMore
    )
      return;
    await fetchFeed(activeFeed, "loadMore");
  }, [activeFeed, feeds, fetchFeed]);

  const addNewPost = useCallback((post: Post) => {
    feedService.invalidateCache();
    setFeeds((prev) => {
      const updated = { ...prev };
      if (post.visibility === "campus" || post.isAnonymous) {
        updated.campus = {
          ...updated.campus,
          posts: [post, ...updated.campus.posts],
        };
      }
      if (post.visibility === "connections") {
        updated.connections = {
          ...updated.connections,
          posts: [post, ...updated.connections.posts],
        };
      }
      if (post.isAnonymous) {
        updated.anonymous = {
          ...updated.anonymous,
          posts: [post, ...updated.anonymous.posts],
        };
      }
      if (post.community) {
        updated.communities = {
          ...updated.communities,
          posts: [post, ...updated.communities.posts],
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

  const refreshOnFocus = useCallback(async () => {
    const now = Date.now();
    const lastTime = lastRefreshTime.current[activeFeed];
    if (now - lastTime > FOCUS_REFRESH_INTERVAL) {
      cursors.current[activeFeed] = null;
      pagination.current[activeFeed] = {
        hasMore: true,
        nextCursor: null,
        limit: 10,
      };
      if (activeFeed !== "communities") {
        await feedService.invalidateFeedCache(activeFeed as any);
      }
      await fetchFeedSilent(activeFeed);
    }
  }, [activeFeed, fetchFeedSilent]);

  const forceRefresh = useCallback(async () => {
    cursors.current[activeFeed] = null;
    pagination.current[activeFeed] = {
      hasMore: true,
      nextCursor: null,
      limit: 10,
    };
    lastRefreshTime.current[activeFeed] = 0;
    await feedService.invalidateCache();
    await fetchFeed(activeFeed, "refresh");
  }, [activeFeed, fetchFeed]);

  const markNeedsRefresh = useCallback(() => {
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
    invalidateAllFeeds,
  };
}
