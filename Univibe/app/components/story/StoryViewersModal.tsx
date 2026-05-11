import React, { memo, useState, useEffect, useRef } from "react";
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
  Animated,
  PanResponder,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import storyApi from "../../../lib/services/storyApi";
import { API_BASE_URL } from "../../../constants/ipConstants";

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.68;
const DISMISS_THRESHOLD = 100;

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
    const router = useRouter();
    const [viewers, setViewers] = useState<Viewer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const translateY = useRef(new Animated.Value(0)).current;
    const isDragging = useRef(false);

    useEffect(() => {
      if (visible) {
        fetchViewers();
        translateY.setValue(0);
      }
    }, [visible, storyId]);

    // Pan responder ONLY for the handle area
    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5,
        onPanResponderGrant: () => {
          isDragging.current = true;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          isDragging.current = false;
          if (gestureState.dy > DISMISS_THRESHOLD || gestureState.vy > 0.3) {
            Animated.timing(translateY, {
              toValue: MODAL_HEIGHT,
              duration: 250,
              useNativeDriver: true,
            }).start(() => {
              onClose();
              translateY.setValue(0);
            });
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              friction: 8,
              tension: 40,
            }).start();
          }
        },
      }),
    ).current;

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

    const getProfilePictureUrl = (profilePicture?: string) => {
      if (!profilePicture) return null;
      return profilePicture.startsWith("http")
        ? profilePicture
        : `${API_BASE_URL}${profilePicture}`;
    };

    const formatTimeAgo = (dateString: string) => {
      const now = new Date();
      const viewed = new Date(dateString);
      const diffMs = now.getTime() - viewed.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHrs < 24) return `${diffHrs}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return viewed.toLocaleDateString();
    };

    const handleViewerPress = (userId: string) => {
      onClose();
      setTimeout(() => {
        router.push(`/profile/${userId}`);
      }, 300);
    };

    const renderViewer = ({ item }: { item: Viewer }) => {
      const profilePictureUrl = getProfilePictureUrl(item.profilePicture);

      return (
        <TouchableOpacity
          style={styles.viewerItem}
          onPress={() => handleViewerPress(item.userId)}
          activeOpacity={0.6}
        >
          <View style={styles.avatarContainer}>
            <View style={styles.storyRing}>
              {profilePictureUrl ? (
                <Image
                  source={{ uri: profilePictureUrl }}
                  style={styles.viewerAvatar}
                />
              ) : (
                <View style={styles.viewerAvatarPlaceholder}>
                  <Text style={styles.viewerAvatarText}>
                    {item.userName?.[0]?.toUpperCase() || "?"}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.viewerInfo}>
            <Text style={styles.viewerName} numberOfLines={1}>
              {item.userName}
            </Text>
            {item.userUsername && (
              <Text style={styles.viewerUsername} numberOfLines={1}>
                @{item.userUsername}
              </Text>
            )}
          </View>
          <Text style={styles.viewedTime}>{formatTimeAgo(item.viewedAt)}</Text>
        </TouchableOpacity>
      );
    };

    const renderHeader = () => (
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          {viewers.length} {viewers.length === 1 ? "viewer" : "viewers"}
        </Text>
      </View>
    );

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
      >
        <View style={styles.overlay}>
          {/* Tap outside to close */}
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>

          {/* Draggable container */}
          <Animated.View
            style={[styles.container, { transform: [{ translateY }] }]}
          >
            {/* Drag Handle - ONLY this area is draggable */}
            <View style={styles.dragArea} {...panResponder.panHandlers}>
              <View style={styles.handle} />
            </View>

            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Viewers</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {isLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#8b5cf6" />
              </View>
            ) : error ? (
              <View style={styles.centerContainer}>
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
                ListHeaderComponent={viewers.length > 0 ? renderHeader : null}
                ListEmptyComponent={
                  <View style={styles.centerContainer}>
                    <Ionicons name="eye-off-outline" size={48} color="#666" />
                    <Text style={styles.emptyText}>No viewers yet</Text>
                    <Text style={styles.emptySubtext}>
                      When someone views your story, they'll appear here
                    </Text>
                  </View>
                }
                showsVerticalScrollIndicator={false}
                contentContainerStyle={
                  viewers.length === 0
                    ? styles.emptyContent
                    : styles.listContent
                }
                ItemSeparatorComponent={() => <View style={styles.separator} />}
              />
            )}
          </Animated.View>
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
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    backgroundColor: "#1c1c1e",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: MODAL_HEIGHT,
    overflow: "hidden",
  },
  dragArea: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderRadius: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  title: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  centerContainer: {
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
    fontFamily: "SofiaSans-Regular",
  },
  retryButton: {
    backgroundColor: "#8b5cf6",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    marginTop: 8,
  },
  retryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  emptyContent: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 34,
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  listHeaderText: {
    color: "#8e8e93",
    fontSize: 13,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "SofiaSans-Medium",
  },
  emptyText: {
    color: "#8e8e93",
    fontSize: 16,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  emptySubtext: {
    color: "#636366",
    fontSize: 13,
    textAlign: "center",
    fontFamily: "SofiaSans-Regular",
  },
  viewerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  avatarContainer: {
    marginRight: 12,
  },
  storyRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2,
    borderWidth: 2,
    borderColor: "#c7c7cc",
  },
  viewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  viewerAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#8b5cf6",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerAvatarText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  viewerInfo: {
    flex: 1,
    marginRight: 12,
  },
  viewerName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  viewerUsername: {
    color: "#8e8e93",
    fontSize: 13,
    marginTop: 1,
    fontFamily: "SofiaSans-Regular",
  },
  viewedTime: {
    color: "#8e8e93",
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    marginLeft: 76,
  },
});

export default StoryViewersModal;
