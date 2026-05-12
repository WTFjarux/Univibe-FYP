import { useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RecentSearch, SearchCategory } from "../lib/types/search";

const RECENT_SEARCHES_KEY = "@univibe_recent_searches";
const MAX_RECENT_SEARCHES = 10;

/**
 * Custom hook for managing recent searches with AsyncStorage persistence.
 *
 * Features:
 * - Persists recent searches locally
 * - Limits to MAX_RECENT_SEARCHES items
 * - Deduplicates queries (moves existing to top)
 * - Supports removing individual items
 * - Supports clearing all items
 */
export function useRecentSearches() {
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load recent searches from AsyncStorage on mount
  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as RecentSearch[];
        setRecentSearches(parsed);
      }
    } catch (error) {
      console.error("Error loading recent searches:", error);
    } finally {
      setLoaded(true);
    }
  };

  // Save to AsyncStorage whenever state changes
  const persistSearches = async (searches: RecentSearch[]) => {
    try {
      await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
    } catch (error) {
      console.error("Error saving recent searches:", error);
    }
  };

  /**
   * Add a new search query
   * - Deduplicates: if query exists, moves it to top with updated timestamp
   * - Limits to MAX_RECENT_SEARCHES
   */
  const addRecentSearch = useCallback(
    async (query: string, type: SearchCategory = "all") => {
      if (!query.trim()) return;

      const trimmedQuery = query.trim();

      setRecentSearches((prev) => {
        // Remove duplicate if exists
        const filtered = prev.filter(
          (item) => item.query.toLowerCase() !== trimmedQuery.toLowerCase(),
        );

        // Create new search entry
        const newSearch: RecentSearch = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          query: trimmedQuery,
          type,
          timestamp: Date.now(),
        };

        // Add to beginning and limit size
        const updated = [newSearch, ...filtered].slice(0, MAX_RECENT_SEARCHES);

        // Persist in background
        persistSearches(updated);

        return updated;
      });
    },
    [],
  );

  /**
   * Remove a single recent search by ID
   */
  const removeRecentSearch = useCallback(async (id: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      persistSearches(updated);
      return updated;
    });
  }, []);

  /**
   * Clear all recent searches
   */
  const clearRecentSearches = useCallback(async () => {
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
      console.error("Error clearing recent searches:", error);
    }
  }, []);

  /**
   * Get recent searches filtered by category
   */
  const getRecentByType = useCallback(
    (type: SearchCategory): RecentSearch[] => {
      return recentSearches.filter((item) => item.type === type);
    },
    [recentSearches],
  );

  return {
    recentSearches,
    loaded,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
    getRecentByType,
  };
}
