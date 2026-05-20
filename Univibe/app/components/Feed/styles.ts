// app/(tabs)/feed/styles.ts
import { StyleSheet, Platform } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 60,
  },
  bottomPadding: {
    height: 0,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  postsContainer: {

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
    fontFamily: "SofiaSans-Regular",
    fontSize: 14,
  },
  errorText: {
    fontSize: 16,
    color: "#ef4444",
    fontFamily: "SofiaSans-Regular",
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
    fontFamily: "SofiaSans-Regular",
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
    fontFamily: "SofiaSans-Regular",
    fontSize: 14,

    fontWeight: "600",
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
  },
  emptyStateText: {
    fontSize: 18,
    fontFamily: "SofiaSans-Regular",
    color: "#374151",
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
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
    fontFamily: "SofiaSans-Regular",
    fontWeight: "600",
  },
  infoBar: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 100 : 80,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 45, 
    zIndex: 9999,
  },
  infoBarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
    flex: 1,
    textAlign: "left",
    lineHeight: 20,
  },
  undoButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 6,
  },
  undoButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    letterSpacing: 0.5,
  },
});

export default styles;
