import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";

interface SearchEmptyStateProps {
  type?: "no_query" | "no_results" | "no_recent";
  query?: string;
}

/**
 * Empty state components for search.
 *
 * Three variants:
 * - no_query: Shown when user hasn't typed anything yet
 * - no_results: Shown when search returned no results
 * - no_recent: Shown when there are no recent searches
 */
export const SearchEmptyState: React.FC<SearchEmptyStateProps> = ({
  type = "no_query",
  query = "",
}) => {
  const { colors } = useTheme();

  if (type === "no_query") {
    return (
      <View style={styles.container}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.skeleton }]}
        >
          <Ionicons name="search-outline" size={48} color={colors.textMuted} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          Search Univibes
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Find students, posts, and events{"\n"}across your campus
        </Text>
      </View>
    );
  }

  if (type === "no_results") {
    return (
      <View style={styles.container}>
        <View
          style={[styles.iconContainer, { backgroundColor: colors.skeleton }]}
        >
          <Ionicons
            name="file-tray-outline"
            size={48}
            color={colors.textMuted}
          />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          No results found
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          We couldn't find anything for "{query}"{"\n"}
          Try a different search term or adjust your filters
        </Text>
      </View>
    );
  }

  if (type === "no_recent") {
    return (
      <View style={styles.compactContainer}>
        <Ionicons name="time-outline" size={20} color={colors.textMuted} />
        <Text style={[styles.compactText, { color: colors.textMuted }]}>
          No recent searches
        </Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "SofiaSans-Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  compactText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
});

export default SearchEmptyState;
