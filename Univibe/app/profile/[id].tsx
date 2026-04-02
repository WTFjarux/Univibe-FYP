// app/profile/[id].tsx - Updated with cleaner layout

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  StyleSheet,
  FlatList,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useNavigation } from "@react-navigation/native";

import { useAuth } from "../../lib/AuthContext";
import { profileService } from "../../lib/profileService";
import { connectionService } from "../../lib/connectionService";
import {
  getProfilePosts,
  toggleLike,
  deletePost,
  Post,
} from "../../lib/postService";

import ProfileHeader from "../components/Profile/ProfileHeader";
import ProfileInfo from "../components/Profile/ProfileInfo";
import ProfileStats from "../components/Profile/ProfileStats";
import PostCard from "../components/Feed/Post/PostCard";
import { styles } from "../components/Profile/profileStyles";

type ConnectionStatus =
  | "connected"
  | "pending_sent"
  | "pending_received"
  | "not_connected";

interface PublicProfile {
  _id: string;
  user: {
    _id: string;
    username: string;
    email: string;
    profileComplete: boolean;
    name?: string;
  };
  fullName: string;
  username: string;
  bio: string;
  major: string;
  year: string;
  graduationYear: string;
  pronouns: string;
  profilePicture: string;
  coverPhoto: string;
  socialLinks: {
    instagram: string;
    linkedin: string;
    github: string;
  };
  stats: {
    posts: number;
    connections: number;
    groups: number;
  };
}

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { user: currentUser, refreshUserProfile, token } = useAuth();

  // Profile state
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("not_connected");
  const [connectionLoading, setConnectionLoading] = useState(false);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [viewerStatus, setViewerStatus] = useState({
    isOwnProfile: false,
    isConnected: false,
  });

  // User interaction states
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set());
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());

  const isOwnProfile = currentUser?.id === id;

  // Hide tab bar when this screen mounts
  useEffect(() => {
    const parent = navigation.getParent();
    if (parent) {
      parent.setOptions({ tabBarStyle: { display: "none" } });
    }
    return () => {
      if (parent) {
        parent.setOptions({ tabBarStyle: { display: "flex" } });
      }
    };
  }, [navigation]);

  const goBack = () => router.back();

  // Load profile posts based on connection status
  const loadProfilePosts = async (page = 1, shouldAppend = false) => {
    if (!id || postsLoading) return;

    setPostsLoading(true);
    try {
      const response = await getProfilePosts(id as string, page, 10);

      if (response.success && response.data) {
        const filteredPosts = response.data.posts.filter(
          (post) =>
            !hiddenPosts.has(post._id) &&
            !mutedUsers.has(post.user?._id || "") &&
            !blockedUsers.has(post.user?._id || ""),
        );

        setPosts((prev) =>
          shouldAppend ? [...prev, ...filteredPosts] : filteredPosts,
        );
        setHasMorePosts(response.data.pagination.pages > page);
        setViewerStatus(response.data.viewerStatus);
        setPostsPage(page);
      }
    } catch (error) {
      console.error("Error loading profile posts:", error);
    } finally {
      setPostsLoading(false);
    }
  };

  const loadMorePosts = () => {
    if (!postsLoading && hasMorePosts && token) {
      loadProfilePosts(postsPage + 1, true);
    }
  };

  // Load connection status
  const loadConnectionStatus = async () => {
    if (!id || isOwnProfile) return;

    try {
      const response = await connectionService.getConnectionStatus(
        id as string,
      );
      if (response.success) {
        const backendStatus = response.data.status as string;
        let status: ConnectionStatus = "not_connected";

        if (backendStatus === "connected") {
          status = "connected";
        } else if (
          backendStatus === "pending_sent" ||
          backendStatus === "request_sent"
        ) {
          status = "pending_sent";
        } else if (
          backendStatus === "pending_received" ||
          backendStatus === "request_received"
        ) {
          status = "pending_received";
        }
        setConnectionStatus(status);
      }
    } catch (error) {
      console.error("Error loading connection status:", error);
    }
  };

  // Load profile data
  const loadProfile = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await profileService.getPublicProfile(id as string);
      if (response.success && response.data) {
        const profileData = response.data.profile;
        const userData = response.data.user;

        setProfile({
          _id: profileData._id,
          user: {
            _id: userData._id,
            username: userData.username,
            email: userData.email || "",
            profileComplete: userData.profileComplete,
            name: userData.name,
          },
          fullName: profileData.fullName || userData.name || "User",
          username: profileData.username || userData.username,
          bio: profileData.bio || "",
          major: profileData.major || "",
          year: profileData.year || "",
          graduationYear: profileData.graduationYear || "",
          pronouns: profileData.pronouns || "",
          profilePicture: profileData.profilePicture || "",
          coverPhoto: profileData.coverPhoto || "",
          socialLinks: profileData.socialLinks || {
            instagram: "",
            linkedin: "",
            github: "",
          },
          stats: profileData.stats || { posts: 0, connections: 0, groups: 0 },
        });

        if (!isOwnProfile) {
          await loadConnectionStatus();
        }

        await loadProfilePosts(1, false);
      } else {
        Alert.alert("Error", response.message || "Failed to load profile");
        goBack();
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
      Alert.alert("Error", error.message || "Failed to load profile");
      goBack();
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    if (!token) return;

    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  };

  const refreshCurrentUserProfile = async () => {
    try {
      if (refreshUserProfile) await refreshUserProfile();
      if (isOwnProfile) await loadProfile();
    } catch (error) {
      console.error("Error refreshing current user profile:", error);
    }
  };

  // Handle like action
  const handleLike = async (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to like posts");
      return;
    }

    try {
      const response = await toggleLike(postId);

      setPosts((prevPosts) =>
        prevPosts.map((post) =>
          post._id === postId
            ? {
                ...post,
                likes: response.isLiked
                  ? [
                      ...(post.likes || []),
                      { _id: currentUser?.id || "current-user" },
                    ]
                  : post.likes?.filter(
                      (like: any) => like._id !== currentUser?.id,
                    ),
                isLiked: response.isLiked,
              }
            : post,
        ),
      );
    } catch (error: any) {
      console.error("Error liking post:", error);
      Alert.alert("Error", error.message || "Failed to like post");
    }
  };

  const handleComment = (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to comment");
      return;
    }

    router.push({
      pathname: "/components/Feed/Comment/CommentsScreen",
      params: { postId },
    });
  };

  const handleRepost = (postId: string) => {
    if (!token) {
      Alert.alert("Login Required", "Please login to repost");
      return;
    }
    Alert.alert("Repost", "Repost feature coming soon!");
  };

  const handleShare = (postId: string) => {
    Alert.alert("Share", "Share feature coming soon!");
  };

  const handleEditPost = (postId: string) => {
    router.push({
      pathname: "/components/Feed/Post/EditPost",
      params: { postId },
    });
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await deletePost(postId);
      setPosts((prev) => prev.filter((post) => post._id !== postId));
      Alert.alert("Success", "Post deleted successfully");
    } catch (error: any) {
      console.error("Error deleting post:", error);
      Alert.alert("Error", error.message || "Failed to delete post");
    }
  };

  const handleSavePost = (postId: string) => {
    setSavedPosts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
        Alert.alert("Post Unsaved", "Post removed from your saved items");
      } else {
        newSet.add(postId);
        Alert.alert("Post Saved", "Post added to your saved items");
      }
      return newSet;
    });
  };

  const handleReportPost = (postId: string) => {
    Alert.alert("Report Submitted", "Thank you for reporting this post.");
  };

  const handleHidePost = (postId: string) => {
    setHiddenPosts((prev) => {
      const newSet = new Set(prev);
      newSet.add(postId);
      return newSet;
    });
    setPosts((prev) => prev.filter((post) => post._id !== postId));
    Alert.alert("Post Hidden", "You won't see this post anymore");
  };

  const handleCopyLink = (postId: string) => {
    Alert.alert("Link Copied", "Post link copied to clipboard");
  };

  const handleMuteUser = (userId: string) => {
    setMutedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.add(userId);
      return newSet;
    });
    setPosts((prev) => prev.filter((post) => post.user?._id !== userId));
    Alert.alert("User Muted", "You won't see posts from this user anymore");
  };

  const handleBlockUser = (userId: string) => {
    setBlockedUsers((prev) => {
      const newSet = new Set(prev);
      newSet.add(userId);
      return newSet;
    });
    setPosts((prev) => prev.filter((post) => post.user?._id !== userId));
    Alert.alert("User Blocked", "You won't see posts from this user anymore");
  };

  // Handle connection action
  const handleConnectionAction = async () => {
    if (!profile) return;
    setConnectionLoading(true);

    try {
      switch (connectionStatus) {
        case "not_connected":
          const sendResponse = await connectionService.sendConnectionRequest(
            profile.user._id,
          );
          if (sendResponse.success) {
            if (
              sendResponse.data?.autoAccepted ||
              sendResponse.data?.status === "connected"
            ) {
              setConnectionStatus("connected");
              setProfile((prev) =>
                prev
                  ? {
                      ...prev,
                      stats: {
                        ...prev.stats,
                        connections: (prev.stats.connections || 0) + 1,
                      },
                    }
                  : null,
              );
              await refreshCurrentUserProfile();
              await loadProfilePosts(1, false);
              Alert.alert(
                "Connected!",
                `You are now connected with ${profile.fullName}`,
              );
            } else {
              setConnectionStatus("pending_sent");
              Alert.alert(
                "Request Sent",
                `Connection request sent to ${profile.fullName}`,
              );
            }
          } else {
            Alert.alert(
              "Error",
              sendResponse.message || "Failed to send request",
            );
          }
          break;

        case "pending_sent":
          Alert.alert(
            "Cancel Request",
            `Cancel request to ${profile.fullName}?`,
            [
              { text: "No", style: "cancel" },
              {
                text: "Yes",
                onPress: async () => {
                  const cancelResponse =
                    await connectionService.cancelConnectionRequest(
                      profile.user._id,
                    );
                  if (cancelResponse.success) {
                    setConnectionStatus("not_connected");
                    Alert.alert(
                      "Request Cancelled",
                      "Connection request cancelled",
                    );
                  }
                },
              },
            ],
          );
          break;

        case "pending_received":
          Alert.alert(
            "Accept Request",
            `Accept connection request from ${profile.fullName}?`,
            [
              { text: "No", style: "cancel" },
              {
                text: "Yes",
                onPress: async () => {
                  const acceptResponse =
                    await connectionService.acceptConnectionRequest(
                      profile.user._id,
                    );
                  if (acceptResponse.success) {
                    setConnectionStatus("connected");
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            stats: {
                              ...prev.stats,
                              connections: (prev.stats.connections || 0) + 1,
                            },
                          }
                        : null,
                    );
                    await refreshCurrentUserProfile();
                    await loadProfilePosts(1, false);
                    Alert.alert(
                      "Connected!",
                      `You are now connected with ${profile.fullName}`,
                    );
                  } else {
                    Alert.alert(
                      "Error",
                      acceptResponse.message || "Failed to accept request",
                    );
                  }
                },
              },
            ],
          );
          break;

        case "connected":
          Alert.alert(
            "Remove Connection",
            `Remove connection with ${profile.fullName}?`,
            [
              { text: "No", style: "cancel" },
              {
                text: "Yes",
                onPress: async () => {
                  const removeResponse =
                    await connectionService.removeConnection(profile.user._id);
                  if (removeResponse.success) {
                    setConnectionStatus("not_connected");
                    setProfile((prev) =>
                      prev
                        ? {
                            ...prev,
                            stats: {
                              ...prev.stats,
                              connections: Math.max(
                                (prev.stats.connections || 0) - 1,
                                0,
                              ),
                            },
                          }
                        : null,
                    );
                    await refreshCurrentUserProfile();
                    await loadProfilePosts(1, false);
                    Alert.alert(
                      "Connection Removed",
                      `You are no longer connected with ${profile.fullName}`,
                    );
                  } else {
                    Alert.alert(
                      "Error",
                      removeResponse.message || "Failed to remove connection",
                    );
                  }
                },
              },
            ],
          );
          break;
      }
    } catch (error: any) {
      console.error("Connection action error:", error);
      Alert.alert("Error", error.message || "Failed to process request");
    } finally {
      setConnectionLoading(false);
    }
  };

  // Reload profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (token) {
        loadProfile();
      }
    }, [id, token]),
  );

  // Get button config
  const getConnectionButtonConfig = () => {
    switch (connectionStatus) {
      case "connected":
        return {
          text: "Connected",
          icon: "checkmark-circle",
          style: "connected" as const,
        };
      case "pending_sent":
        return {
          text: "Request Sent",
          icon: "time",
          style: "pending" as const,
        };
      case "pending_received":
        return {
          text: "Accept Request",
          icon: "person-add",
          style: "accept" as const,
        };
      default:
        return {
          text: "Connect",
          icon: "person-add",
          style: "connect" as const,
        };
    }
  };

  const buttonConfig = getConnectionButtonConfig();

  const getButtonStyle = () => {
    switch (buttonConfig.style) {
      case "connected":
        return publicStyles.connectionButton_connected;
      case "pending":
        return publicStyles.connectionButton_pending;
      case "accept":
        return publicStyles.connectionButton_accept;
      default:
        return publicStyles.connectionButton_connect;
    }
  };

  const formattedUser = {
    _id: profile?.user._id,
    name: profile?.fullName,
    email: profile?.user.email,
    username: profile?.username,
    profileComplete: profile?.user.profileComplete,
  };

  // Render posts header - Simplified to just "Posts"
  const renderPostsHeader = () => (
    <View style={publicStyles.postsHeader}>
      <Text style={publicStyles.postsTitle}>Posts</Text>
    </View>
  );

  // Render post item
  const renderPost = ({ item }: { item: Post }) => (
    <View style={publicStyles.postCardContainer}>
      <PostCard
        post={item}
        onLikePress={handleLike}
        onCommentPress={handleComment}
        onRepostPress={handleRepost}
        onSharePress={handleShare}
        onEdit={handleEditPost}
        onDelete={handleDeletePost}
        onSave={handleSavePost}
        onReport={handleReportPost}
        onHide={handleHidePost}
        onCopyLink={handleCopyLink}
        onMuteUser={handleMuteUser}
        onBlockUser={handleBlockUser}
      />
    </View>
  );

  // Render empty posts state
  const renderEmptyPosts = () => (
    <View style={publicStyles.emptyPostsContainer}>
      <Ionicons name="document-text-outline" size={48} color="#d1d5db" />
      <Text style={publicStyles.emptyPostsTitle}>No posts yet</Text>
      <Text style={publicStyles.emptyPostsText}>
        {viewerStatus.isConnected
          ? "This user hasn't posted anything yet."
          : "Be the first to connect and see their posts!"}
      </Text>
    </View>
  );

  // Render footer loader
  const renderFooterLoader = () => {
    if (!postsLoading) return null;
    return (
      <ActivityIndicator style={publicStyles.footerLoader} color="#8b5cf6" />
    );
  };

  if (loading && !profile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noProfileContainer}>
          <Ionicons name="person-circle-outline" size={100} color="#d1d5db" />
          <Text style={styles.noProfileTitle}>Profile Not Found</Text>
          <TouchableOpacity style={styles.setupButton} onPress={goBack}>
            <Text style={styles.setupButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={publicStyles.header}>
        <TouchableOpacity onPress={goBack} style={publicStyles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={publicStyles.headerTitle} numberOfLines={1}>
          {profile.fullName}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item._id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={publicStyles.flatListContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#8b5cf6"
            colors={["#8b5cf6"]}
          />
        }
        ListHeaderComponent={
          <>
            <ProfileHeader
              user={formattedUser}
              profile={profile}
              uploading={false}
              coverUploading={false}
              onImagePress={() => {}}
              onCoverPhotoPress={() => {}}
              isPublicView={true}
            />

            <View style={styles.content}>
              {!isOwnProfile && (
                <View style={publicStyles.connectionButtonContainer}>
                  <TouchableOpacity
                    style={[publicStyles.connectionButton, getButtonStyle()]}
                    onPress={handleConnectionAction}
                    disabled={connectionLoading}
                  >
                    {connectionLoading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Ionicons
                          name={buttonConfig.icon as any}
                          size={20}
                          color={
                            buttonConfig.style === "connected"
                              ? "#10b981"
                              : "#fff"
                          }
                        />
                        <Text
                          style={[
                            publicStyles.connectionButtonText,
                            buttonConfig.style === "connected" &&
                              publicStyles.connectedButtonText,
                          ]}
                        >
                          {buttonConfig.text}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              <ProfileInfo profile={profile} user={profile.user} />
              <ProfileStats
                stats={{
                  posts: profile.stats?.posts || 0,
                  connections: profile.stats?.connections || 0,
                  groups: profile.stats?.groups || 0,
                }}
              />
              {renderPostsHeader()}
            </View>
          </>
        }
        ListFooterComponent={renderFooterLoader()}
        ListEmptyComponent={
          posts.length === 0 && !postsLoading ? renderEmptyPosts() : null
        }
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.3}
      />
    </SafeAreaView>
  );
}

const publicStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  connectionButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  connectionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  connectionButton_connect: { backgroundColor: "#8b5cf6" },
  connectionButton_pending: { backgroundColor: "#f59e0b" },
  connectionButton_accept: { backgroundColor: "#10b981" },
  connectionButton_connected: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  connectionButtonText: { color: "white", fontSize: 16, fontWeight: "600" },
  connectedButtonText: { color: "#10b981" },
  postsHeader: {
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  postsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
  },
  emptyPostsContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyPostsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
  },
  emptyPostsText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 4,
  },
  footerLoader: {
    paddingVertical: 20,
  },
  flatListContent: {
    paddingBottom: 20,
  },
  postCardContainer: {
    paddingHorizontal: 16,
    marginBottom: 8,
  },
});
