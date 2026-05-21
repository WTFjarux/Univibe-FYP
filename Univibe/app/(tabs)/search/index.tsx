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
import { useTheme } from "../../../lib/contexts/ThemeContext";

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
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);

  const {
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
    recentSearches,
    recentSearchesLoaded,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
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

  const showInfoMessage = useCallback((message: string) => {
    setInfoMessage(message);
    if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    infoTimeoutRef.current = setTimeout(() => {
      setInfoMessage(null);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (infoTimeoutRef.current) clearTimeout(infoTimeoutRef.current);
    };
  }, []);

  const handleCategoryChange = useCallback(
    (category: SearchCategory) => {
      setActiveCategory(category);
      if (hasSearched && query.trim().length >= 2) {
        performSearch(category);
      }
    },
    [query, hasSearched, setActiveCategory, performSearch],
  );

  const handleSearchSubmit = useCallback(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length >= 2) {
      performSearch();
      Keyboard.dismiss();
    }
  }, [query, performSearch]);

  const handleClearSearch = useCallback(() => {
    setQuery("");
    clearResults();
  }, [setQuery, clearResults]);

  const handleRecentSearchTap = useCallback(
    (searchQuery: string, category: SearchCategory) => {
      setQuery(searchQuery);
      setActiveCategory(category);
      performSearch(category, searchQuery);
      Keyboard.dismiss();
    },
    [setQuery, setActiveCategory, performSearch],
  );

  const handleSuggestionTap = useCallback(
    (label: string) => {
      setQuery(label);
      setActiveCategory("all");
      performSearch("all", label);
      Keyboard.dismiss();
    },
    [setQuery, setActiveCategory, performSearch],
  );

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

  const resultCounts = {
    users: userResults.length,
    posts: postResults.length,
    events: eventResults.length,
  };
  const currentResults = getCurrentResults();
  const isInitialLoading = !recentSearchesLoaded;
  const isLoading = isLoadingCategory();

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

  const renderRecentSearches = useCallback(() => {
    if (recentSearches.length === 0) {
      return <SearchEmptyState type="no_recent" />;
    }
    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Recent Searches
          </Text>
          <TouchableOpacity onPress={clearRecentSearches}>
            <Text style={[styles.clearAllText, { color: colors.primary }]}>
              Clear all
            </Text>
          </TouchableOpacity>
        </View>
        {recentSearches.slice(0, 5).map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.recentItem}
            onPress={() => handleRecentSearchTap(item.query, item.type)}
          >
            <Ionicons
              name="time-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.recentText, { color: colors.text }]}
              numberOfLines={1}
            >
              {item.query}
            </Text>
            <TouchableOpacity
              onPress={() => removeRecentSearch(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={16} color={colors.textMuted} />
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
    colors,
  ]);

  const renderTrendingSuggestions = useCallback(
    () => (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Suggested for You
        </Text>
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
              style={[
                styles.suggestionChip,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => handleSuggestionTap(item.label)}
            >
              <Ionicons
                name={item.icon as any}
                size={16}
                color={colors.textSecondary}
              />
              <Text style={[styles.suggestionText, { color: colors.text }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    ),
    [handleSuggestionTap, colors],
  );

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

  const renderListFooter = useCallback(() => {
    if (isLoading && currentResults.length > 0) {
      return (
        <View style={styles.loadingMore}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingMoreText, { color: colors.primary }]}>
            Loading more...
          </Text>
        </View>
      );
    }
    return null;
  }, [isLoading, currentResults.length, colors]);

  if (isInitialLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <InitialSearchSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Search</Text>
      </View>
      <SearchBar
        value={query}
        onChangeText={(text) => {
          setQuery(text);
        }}
        onSubmit={() => {
          if (query.trim().length >= 2) {
            performSearch(activeCategory, query.trim());
          }
          Keyboard.dismiss();
        }}
        loading={isSearching}
        onClear={handleClearSearch}
      />
      <View style={styles.categoriesWrapper}>
        <SearchCategories
          activeCategory={activeCategory}
          onCategoryChange={handleCategoryChange}
          resultCounts={hasSearched ? resultCounts : undefined}
        />
      </View>
      {infoMessage && (
        <View style={[styles.infoToast, { backgroundColor: colors.primary }]}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#ffffff"
          />
          <Text style={styles.infoToastText}>{infoMessage}</Text>
        </View>
      )}
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
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  title: { fontSize: 28, fontWeight: "bold", fontFamily: "SofiaSans-Bold" },
  listContent: { paddingBottom: 40 },
  emptyListContent: { flexGrow: 1 },
  section: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  clearAllText: { fontSize: 13, fontFamily: "SofiaSans-Medium" },
  recentItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 1,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 6,
    gap: 10,
  },
  recentText: { flex: 1, fontSize: 15, fontFamily: "SofiaSans-Regular" },
  suggestionsGrid: {
    paddingTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 13, fontFamily: "SofiaSans-Medium" },
  infoToast: {
    flexDirection: "row",
    alignItems: "center",
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
  loadingMore: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  loadingMoreText: { fontSize: 13, fontFamily: "SofiaSans-Regular" },
  categoriesWrapper: { marginBottom: 16 },
});
