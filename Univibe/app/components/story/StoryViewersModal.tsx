import React, { memo, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import storyApi from "../../../lib/services/storyApi";
import { API_BASE_URL } from "../../../constants/ipConstants";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface StoryViewersModalProps {
  visible: boolean;
  storyId: string;
  onClose: () => void;
}

interface Viewer {
  _id: string;
  userId: string;
  userName: string;
  userUsername?: string;
  profilePicture?: string;
  viewedAt: string;
}

const StoryViewersModal = memo(
  ({ visible, storyId, onClose }: StoryViewersModalProps) => {
    const [viewers, setViewers] = useState<Viewer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      if (visible) {
        fetchViewers();
      }
    }, [visible, storyId]);

    const fetchViewers = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await storyApi.getStoryViewers(storyId);

        if (response.success && response.data) {
          setViewers(response.data);
        } else {
          setViewers([]);
        }
      } catch (error: any) {
        console.error("Error fetching viewers:", error);
        setError(error?.message || "Failed to load viewers");
        setViewers([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Helper function to get profile picture URL (same as StoryHeader)
    const getProfilePictureUrl = (profilePicture?: string) => {
      if (!profilePicture) return null;
      return profilePicture.startsWith("http")
        ? profilePicture
        : `${API_BASE_URL}${profilePicture}`;
    };

    const renderViewer = ({ item }: { item: Viewer }) => {
      const profilePictureUrl = getProfilePictureUrl(item.profilePicture);

      return (
        <View style={styles.viewerItem}>
          {profilePictureUrl ? (
            <Image
              source={{ uri: profilePictureUrl }}
              style={styles.viewerAvatar}
              onError={(e) =>
                console.log("Image load error:", e.nativeEvent.error)
              }
            />
          ) : (
            <View style={styles.viewerAvatarPlaceholder}>
              <Text style={styles.viewerAvatarText}>
                {item.userName?.[0]?.toUpperCase() || "?"}
              </Text>
            </View>
          )}
          <View style={styles.viewerInfo}>
            <Text style={styles.viewerName}>{item.userName}</Text>
            {item.userUsername && (
              <Text style={styles.viewerUsername}>@{item.userUsername}</Text>
            )}
          </View>
        </View>
      );
    };

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          <TouchableOpacity
            style={styles.backdrop}
            onPress={onClose}
            activeOpacity={1}
          />
          <View style={styles.container}>
            <View style={styles.handle} />
            <View style={styles.header}>
              <Text style={styles.title}>Viewers ({viewers.length})</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
                <Text style={styles.loadingText}>Loading viewers...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons
                  name="alert-circle-outline"
                  size={48}
                  color="#ef4444"
                />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={fetchViewers}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={viewers}
                renderItem={renderViewer}
                keyExtractor={(item) => item._id}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Ionicons name="eye-off-outline" size={48} color="#666" />
                    <Text style={styles.emptyText}>No viewers yet</Text>
                    <Text style={styles.emptySubtext}>
                      When someone views your story, they'll appear here
                    </Text>
                  </View>
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                  viewers.length === 0 ? styles.emptyContent : undefined
                }
              />
            )}
          </View>
        </View>
      </Modal>
    );
  },
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0)",
  },
  container: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: SCREEN_HEIGHT * 0.75,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: "#666",
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: "#aaa",
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 14,
    textAlign: "center",
  },
  retryButton: {
    backgroundColor: "#8b5cf6",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 48,
    paddingHorizontal: 32,
  },
  emptyContent: {
    flex: 1,
  },
  emptyText: {
    color: "#666",
    fontSize: 16,
    marginTop: 8,
  },
  emptySubtext: {
    color: "#666",
    fontSize: 12,
    marginTop: 4,
    textAlign: "center",
  },
  viewerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#222",
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  viewerAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerAvatarText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  viewerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  viewerName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  viewerUsername: {
    color: "#999",
    fontSize: 12,
    marginTop: 2,
  },
});

export default StoryViewersModal;
