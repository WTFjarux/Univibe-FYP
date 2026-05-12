import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SearchErrorStateProps {
  message?: string;
  onRetry: () => void;
}

/**
 * Error state component for search failures.
 *
 * Features:
 * - Error message display
 * - Retry button
 * - Customizable message
 */
export const SearchErrorState: React.FC<SearchErrorStateProps> = ({
  message = "Something went wrong while searching. Please try again.",
  onRetry,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Ionicons name="alert-circle-outline" size={48} color="#ef4444" />
      </View>

      <Text style={styles.title}>Search Failed</Text>

      <Text style={styles.message}>{message}</Text>

      <TouchableOpacity
        style={styles.retryButton}
        onPress={onRetry}
        activeOpacity={0.7}
      >
        <Ionicons name="refresh-outline" size={18} color="#ffffff" />
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
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
    backgroundColor: "#fef2f2",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
    marginBottom: 8,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  retryText: {
    fontSize: 15,
    color: "#ffffff",
    fontFamily: "SofiaSans-Bold",
  },
});

export default SearchErrorState