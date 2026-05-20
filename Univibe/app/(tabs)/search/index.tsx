import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { useSearch } from "../../../hooks/useSearch";
import { useAuth } from "../../../lib/contexts/AuthContext";
import { connectionService } from "../../../lib/services/connectionService";
import { SearchBar } from "../../components/Search/SearchBar";
import { SearchCategories } from "../../components/Search/SearchCategories";
import { UserSearchResult } from "../../components/Search/UserSearchResult";
import { PostSearchResult } from "../../components/Search/PostSearchResult";
import { EventSearchResult } from "../../components/Search/EventSearchResult";
import {
  SearchSkeleton,
  InitialSearchSkeleton,
} from "../../components/Search/SearchSkeleton";
import { SearchEmptyState } from "../../components/Search/SearchEmptyState";
import { SearchErrorState } from "../../components/Search/SearchErrorState";
import {
  SearchCategory,
  UserSearchResult as UserSearchResultType,
  PostSearchResult as PostSearchResultType,
  EventSearchResult as EventSearchResultType,
} from "../../../lib/types/search";

export default function SearchScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const {
    // State
    query,
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
  } = useSearch();

  const [connectionLoading, setConnectionLoading] = useState<string | null>(
    null,
  );
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Show temporary info message
  const showInfoMessage = useCallback((message: string) => {
    setInfoMessage(message);
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    infoTimeoutRef.current = setTimeout(() => {
      setInfoMessage(null);
    }, 3000);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    };
  }, []);

  // Handle category change — re-search if results already exist
  const handleCategoryChange = useCallback(
    (category: SearchCategory) => {
      setActiveCategory(category);
      if (hasSearched && query.trim().length >= 2) {
        performSearch(category);
      }
    },
    [query, hasSearched, setActiveCategory, performSearch],
  );

  // Handle search submit from keyboard (user presses return)
  const handleSearchSubmit = useCallback(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length >= 2) {
      performSearch();
      Keyboard.dismiss();
    }
  }, [query, performSearch]);

  // Handle clear search
  const handleClearSearch = useCallback(() => {
    setQuery("");
    clearResults();
  }, [setQuery, clearResults]);

  // Handle recent search tap
  const handleRecentSearchTap = useCallback(
    (searchQuery: string, category: SearchCategory) => {
      setQuery(searchQuery);
      setActiveCategory(category);
      // Pass query and category directly to avoid state timing issues
      performSearch(category, searchQuery);
      Keyboard.dismiss();
    },
    [setQuery, setActiveCategory, performSearch],
  );

  // Handle suggestion chip tap
  const handleSuggestionTap = useCallback(
    (label: string) => {
      setQuery(label);
      setActiveCategory("all");
      performSearch("all", label);
      Keyboard.dismiss();
    },
    [setQuery, setActiveCategory, performSearch],
  );

  // Handle connection action from user result
  const handleConnectionPress = useCallback(
    async (userId: string, currentStatus: string) => {
      if (!token) {
        showInfoMessage("Please login to connect");
        return;
      }

      setConnectionLoading(userId);

      try {
        if (currentStatus === "connected") {
          const response = await connectionService.removeConnection(userId);
          if (response.success) {
            showInfoMessage("Connection removed");
          }
        } else if (currentStatus === "pending_sent") {
          const response =
            await connectionService.cancelConnectionRequest(userId);
          if (response.success) {
            showInfoMessage("Request cancelled");
          }
        } else {
          const response =
            await connectionService.sendConnectionRequest(userId);
          if (response.success) {
            if (response.data?.autoAccepted) {
              showInfoMessage("Connected!");
            } else {
              showInfoMessage("Request sent!");
            }
          }
        }
      } catch (error: any) {
        showInfoMessage(error.message || "Action failed");
      } finally {
        setConnectionLoading(null);
      }
    },
    [token, showInfoMessage],
  );

  // Get current results based on active category
  const getCurrentResults = useCallback(() => {
    switch (activeCategory) {
      case "users":
        return userResults;
      case "posts":
        return postResults;
      case "events":
        return eventResults;
      case "all":
      default: {
        // Interleave results for "All" tab
        const combined: any[] = [];
        const maxLength = Math.max(
          userResults.length,
          postResults.length,
          eventResults.length,
        );
        for (let i = 0; i < maxLength; i++) {
          if (userResults[i])
            combined.push({ ...userResults[i], _type: "user" });
          if (postResults[i])
            combined.push({ ...postResults[i], _type: "post" });
          if (eventResults[i])
            combined.push({ ...eventResults[i], _type: "event" });
        }
        return combined;
      }
    }
  }, [activeCategory, userResults, postResults, eventResults]);

  // Check if current category has more pages
  const hasMorePages = useCallback(() => {
    switch (activeCategory) {
      case "users":
        return userPagination
          ? userPagination.page < userPagination.pages
          : false;
      case "posts":
        return postPagination
          ? postPagination.page < postPagination.pages
          : false;
      case "events":
        return eventPagination
          ? eventPagination.page < eventPagination.pages
          : false;
      default:
        return false;
    }
  }, [activeCategory, userPagination, postPagination, eventPagination]);

  // Check if currently loading for active category
  const isLoadingCategory = useCallback(() => {
    switch (activeCategory) {
      case "users":
        return loadingUsers;
      case "posts":
        return loadingPosts;
      case "events":
        return loadingEvents;
      case "all":
        return loadingUsers || loadingPosts || loadingEvents;
    }
  }, [activeCategory, loadingUsers, loadingPosts, loadingEvents]);

  // Result counts for category tabs
  const resultCounts = {
    users: userResults.length,
    posts: postResults.length,
    events: eventResults.length,
  };

  const currentResults = getCurrentResults();
  const isInitialLoading = !recentSearchesLoaded;
  const isLoading = isLoadingCategory();

  // ============================================
  // RENDER FUNCTIONS
  // ============================================

  // Render a single search result item
  const renderResultItem = useCallback(
    ({ item }: { item: any }) => {
      if (item._type === "user" || activeCategory === "users") {
        return (
          <UserSearchResult
            user={item as UserSearchResultType}
            onConnectionPress={handleConnectionPress}
            connectionLoading={connectionLoading === item.user?._id}
          />
        );
      }
      if (item._type === "post" || activeCategory === "posts") {
        return <PostSearchResult post={item as PostSearchResultType} />;
      }
      if (item._type === "event" || activeCategory === "events") {
        return <EventSearchResult event={item as EventSearchResultType} />;
      }
      return null;
    },
    [activeCategory, handleConnectionPress, connectionLoading],
  );

  // Recent searches section
  const renderRecentSearches = useCallback(() => {
    if (recentSearches.length === 0) {
      return <SearchEmptyState type="no_recent" />;
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Searches</Text>
          <TouchableOpacity onPress={clearRecentSearches}>
            <Text style={styles.clearAllText}>Clear all</Text>
          </TouchableOpacity>
        </View>
        {recentSearches.slice(0, 5).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.recentItem}
            onPress={() => handleRecentSearchTap(item.query, item.type)}
          >
            <Ionicons name="time-outline" size={18} color="#6b7280" />
            <Text style={styles.recentText} numberOfLines={1}>
              {item.query}
            </Text>
            <TouchableOpacity
              onPress={() => removeRecentSearch(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color="#9ca3af" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    );
  }, [
    recentSearches,
    clearRecentSearches,
    removeRecentSearch,
    handleRecentSearchTap,
  ]);

  // Trending suggestions
  const renderTrendingSuggestions = useCallback(
    () => (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Suggested for You</Text>
        <View style={styles.suggestionsGrid}>
          {[
            { id: "1", label: "Computer Science", icon: "laptop-outline" },
            { id: "2", label: "Study Groups", icon: "people-outline" },
            { id: "3", label: "Basketball", icon: "basketball-outline" },
            { id: "4", label: "Career Fair", icon: "briefcase-outline" },
            { id: "5", label: "Photography", icon: "camera-outline" },
            { id: "6", label: "Hackathon", icon: "code-slash-outline" },
          ].map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.suggestionChip}
              onPress={() => handleSuggestionTap(item.label)}
            >
              <Ionicons name={item.icon as any} size={16} color="#6b7280" />
              <Text style={styles.suggestionText}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    ),
    [handleSuggestionTap],
  );

  // List header (recent + trending when no search)
  const renderListHeader = useCallback(() => {
    if (!hasSearched || query.trim().length === 0) {
      return (
        <View>
          {renderRecentSearches()}
          {renderTrendingSuggestions()}
        </View>
      );
    }
    return null;
  }, [hasSearched, query, renderRecentSearches, renderTrendingSuggestions]);

  // List empty
  const renderListEmpty = useCallback(() => {
    if (isLoading) return null;
    if (!hasSearched || query.trim().length === 0) return null;
    if (error) {
      return (
        <SearchErrorState message={error} onRetry={() => performSearch()} />
      );
    }
    return <SearchEmptyState type="no_results" query={query} />;
  }, [isLoading, hasSearched, query, error, performSearch]);

  // List footer (loading more)
  const renderListFooter = useCallback(() => {
    if (isLoading && currentResults.length > 0) {
      return (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color="#8b5cf6" />
          <Text style={styles.loadingMoreText}>Loading more...</Text>
        </View>
      );
    }
    return null;
  }, [isLoading, currentResults.length]);

  // ============================================
  // MAIN RENDER
  // ============================================

  if (isInitialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <InitialSearchSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      {/* Search Bar */}
      <SearchBar
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          // Auto-search happens via debounced useEffect in useSearch
        }}
        onSubmit={() => {
          // Optional: Immediate search on keyboard submit
          if (query.trim().length >= 2) {
            performSearch(activeCategory, query.trim());
          }
          Keyboard.dismiss();
        }}
        loading={isSearching}
        onClear={handleClearSearch}
      />

      {/* Categories */}
      <View style={styles.categoriesWrapper}>
        <SearchCategories
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          resultCounts={hasSearched ? resultCounts : undefined}
        />
      </View>

      {/* Info Toast */}
      {infoMessage && (
        <View style={styles.infoToast}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#ffffff"
          />
          <Text style={styles.infoToastText}>{infoMessage}</Text>
        </View>
      )}

      {/* Results / Loading / Empty */}
      {isLoading && currentResults.length === 0 ? (
        <SearchSkeleton
          type={activeCategory === "all" ? "mixed" : activeCategory}
          count={6}
        />
      ) : (
        <FlatList
          ref={flatListRef}
          data={currentResults}
          renderItem={renderResultItem}
          keyExtractor={(item, index) =>
            item._id
              ? `${item._type || activeCategory}-${item._id}`
              : `result-${index}`
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={renderListHeader}
          ListEmptyComponent={renderListEmpty}
          ListFooterComponent={renderListFooter}
          onEndReached={() => {
            if (hasMorePages() && !isLoading) {
              loadMore();
            }
          }}
          onEndReachedThreshold={0.3}
          contentContainerStyle={[
            styles.listContent,
            currentResults.length === 0 && styles.emptyListContent,
          ]}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },

  listContent: {
    paddingBottom: 40,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  // Sections
  section: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  clearAllText: {
    fontSize: 13,
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Medium",
  },
  // Recent items
  recentItem: {
    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 1,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 6,
    gap: 10,
  },
  recentText: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
    fontFamily: "SofiaSans-Regular",
  },
  // Suggestions
  suggestionsGrid: {
    paddingTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  suggestionText: {
    fontSize: 13,
    color: "#374151",
    fontFamily: "SofiaSans-Medium",
  },
  // Info toast
  infoToast: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    marginHorizontal: 20,
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  infoToastText: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: "SofiaSans-Medium",
    flex: 1,
  },
  // Loading more
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 13,
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Regular",
  },
  categoriesWrapper: {
    marginBottom: 16,
  },
});
