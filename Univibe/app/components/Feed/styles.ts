// app/(tabs)/feed/styles.ts
import { StyleSheet } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  postsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  loader: {
    marginVertical: 20,
  },
  endMessage: {
    padding: 20,
    alignItems: "center",
  },
  endMessageText: {
    color: "#9ca3af",
    fontSize: 14,
  },
  // New styles added below
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    marginBottom: 16,
    textAlign: "center",
  },
  loginButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  loginButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  errorContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: "#fef2f2",
    borderRadius: 8,
    alignItems: "center",
  },
  retryButton: {
    marginTop: 12,
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 8,
    textAlign: "center",
    marginHorizontal: 32,
  },
  createFirstPostButton: {
    marginTop: 24,
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  createFirstPostText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
});

export default styles;