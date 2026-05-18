// app/profile/[id].tsx

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Animated,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useNavigation } from "@react-navigation/native";

import { useAuth } from "../../lib/contexts/AuthContext";
import { profileService } from "../../lib/services/profileService";
import { connectionService } from "../../lib/services/connectionService";
import { toggleBlockUser } from "../../lib/services/contentService";
import {
  getProfilePosts,
  toggleLike,
  deletePost,
  Post,
} from "../../lib/services/postService";
import { API_BASE_URL } from "../../constants/ipConstants";

import ProfileHeader from "../components/Profile/ProfileHeader";
import ProfileInfo from "../components/Profile/ProfileInfo";
import ProfileStats from "../components/Profile/ProfileStats";
import PostCard from "../components/Feed/Post/PostCard";
import ProfileSkeleton, {
  LoadingMorePostsSkeleton,
  InitialPostsSkeleton,
} from "../components/Profile/ProfileSkeleton";
import { styles } from "../components/Profile/profileStyles";
import ProfileOptionsModal from "../components/Profile/ProfileOptionsModal";

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

  // ALL STATE DECLARATIONS - Must be at the top, before any conditional returns
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("not_connected");
  const [connectionLoading, setConnectionLoading] = useState(false);

  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [infoType, setInfoType] = useState<"success" | "error" | "info">(
    "info",
  );
  const slideAnim = useState(new Animated.Value(100))[0];

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [initialPostsLoading, setInitialPostsLoading] = useState(true);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [viewerStatus, setViewerStatus] = useState({
    isOwnProfile: false,
    isConnected: false,
  });

  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set());
  const [hiddenPosts, setHiddenPosts] = useState<Set<string>>(new Set());
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set());
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockedByOwner, setIsBlockedByOwner] = useState(false);
  const [profileBlocked, setProfileBlocked] = useState(false);
  const [reportedUsers, setReportedUsers] = useState<Set<string>>(new Set());
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const isOwnProfile = currentUser?.id === id;

  // ALL HOOKS - Must be called unconditionally, before any conditional returns
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

  // This hook MUST be called unconditionally, even if profile is blocked
  useFocusEffect(
    useCallback(() => {
      if (token) loadProfile();
    }, [id, token]),
  );

  // ALL FUNCTION DECLARATIONS - Must be defined before any conditional returns
  const showInfoBar = useCallback(
    (message: string, type: "success" | "error" | "info" = "info") => {
      setInfoMessage(message);
      setInfoType(type);

      Animated.sequence([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(3000),
        Animated.timing(slideAnim, {
          toValue: 100,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setInfoMessage(null);
        slideAnim.setValue(100);
      });
    },
    [slideAnim],
  );

  const goBack = useCallback(() => router.back(), [router]);
  const loadUserStates = useCallback(async () => {
    if (!token || isOwnProfile) return;

    try {
      // Load muted users
      const mutedResponse = await profileService.getMutedUsers(1, 50);
      if (mutedResponse.success && mutedResponse.data) {
        const mutedIds = new Set<string>(
          mutedResponse.data.users.map((u: any) =>
            String(u._id || u.user?._id || ""),
          ),
        );
        // Filter out empty strings
        mutedIds.delete("");
        setMutedUsers(mutedIds);
      }
    } catch (error) {
      console.error("Error loading user states:", error);
    }
  }, [token, isOwnProfile]);

  const loadProfilePosts = useCallback(
    async (page = 1, shouldAppend = false) => {
      if (!id || postsLoading) return;

      if (!isOwnProfile && connectionStatus !== "connected") {
        setInitialPostsLoading(false);
        return;
      }

      if (shouldAppend) {
        setLoadingMorePosts(true);
      } else {
        setInitialPostsLoading(true);
      }
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
        showInfoBar("Failed to load posts", "error");
      } finally {
        setPostsLoading(false);
        setInitialPostsLoading(false);
        setLoadingMorePosts(false);
      }
    },
    [
      id,
      postsLoading,
      isOwnProfile,
      connectionStatus,
      hiddenPosts,
      mutedUsers,
      blockedUsers,
      showInfoBar,
    ],
  );

  const loadConnectionStatus = useCallback(async () => {
    if (!id || isOwnProfile) return;

    try {
      const response = await connectionService.getConnectionStatus(
        id as string,
      );
      if (response.success) {
        const backendStatus = response.data.status as string;
        let status: ConnectionStatus = "not_connected";

        if (backendStatus === "connected") status = "connected";
        else if (
          backendStatus === "pending_sent" ||
          backendStatus === "request_sent"
        )
          status = "pending_sent";
        else if (
          backendStatus === "pending_received" ||
          backendStatus === "request_received"
        )
          status = "pending_received";

        setConnectionStatus(status);

        if (status === "connected") {
          await loadProfilePosts(1, false);
        } else {
          setInitialPostsLoading(false);
        }
      }
    } catch (error) {
      console.error("Error loading connection status:", error);
    }
  }, [id, isOwnProfile, loadProfilePosts]);

  const loadProfile = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await profileService.getPublicProfile(id as string);

      // CHECK: If blocked, show blocked state
      if (response.isBlocked || response.isBlockedByOwner) {
        setProfileBlocked(true);
        setIsBlocked(response.isBlocked || false);
        setIsBlockedByOwner(response.isBlockedByOwner || false);

        // Still try to set basic profile info for the modal
        if (response.data) {
          const profileData = response.data.profile;
          const userData = response.data.user;
          if (profileData && userData) {
            setProfile({
              _id: profileData._id,
              user: {
                _id: userData._id,
                username: userData.username || "",
                email: userData.email || "",
                profileComplete: userData.profileComplete || false,
                name: userData.name || "",
              },
              fullName: userData.name || "User",
              username: userData.username || "",
              bio: "",
              major: "",
              year: "",
              graduationYear: "",
              pronouns: "",
              profilePicture: profileData.profilePicture || "",
              coverPhoto: profileData.coverPhoto || "",
              socialLinks: {
                instagram: "",
                linkedin: "",
                github: "",
              },
              stats: { posts: 0, connections: 0, groups: 0 },
            });
          }
        }

        setLoading(false);
        setInitialLoading(false);
        return;
      }

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
          await loadUserStates();
        } else await loadProfilePosts(1, false);
      } else {
        showInfoBar(response.message || "Failed to load profile", "error");
        goBack();
      }
    } catch (error: any) {
      if (error.response?.status === 403) {
        setProfileBlocked(true);
        setIsBlocked(error.response?.data?.isBlocked || false);
        setIsBlockedByOwner(error.response?.data?.isBlockedByOwner || false);
      } else {
        showInfoBar(error.message || "Failed to load profile", "error");
        goBack();
      }
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [
    id,
    isOwnProfile,
    loadConnectionStatus,
    loadProfilePosts,
    showInfoBar,
    goBack,
  ]);

  const startChat = useCallback(async () => {
    if (!profile) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/direct/${profile.user._id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();

      if (data.success) {
        const avatarUrl = profile.profilePicture || "";
        router.push({
          pathname: "/screens/ChatScreen",
          params: {
            roomId: data.data.roomId,
            otherUserName: profile.fullName,
            otherUserId: profile.user._id,
            otherUserAvatar: avatarUrl,
            isGroup: "false",
          },
        });
      } else {
        showInfoBar(data.message || "Failed to start chat", "error");
      }
    } catch (error) {
      console.error("Error starting chat:", error);
      showInfoBar("Failed to start chat", "error");
    }
  }, [profile, token, router, showInfoBar]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    setRefreshing(true);
    await loadProfile();
    setRefreshing(false);
  }, [token, loadProfile]);

  const refreshCurrentUserProfile = useCallback(async () => {
    try {
      if (refreshUserProfile) await refreshUserProfile();
      if (isOwnProfile) await loadProfile();
    } catch (error) {
      console.error("Error refreshing current user profile:", error);
    }
  }, [refreshUserProfile, isOwnProfile, loadProfile]);

  const handleLike = useCallback(
    async (postId: string) => {
      if (!token) {
        showInfoBar("Please login to like posts", "info");
        return;
      }

      try {
        const response = await toggleLike(postId);

        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post._id === postId
              ? {
                  ...post,
                  isLiked: response.isLiked,
                  likeCount: response.likes,
                }
              : post,
          ),
        );
      } catch (error: any) {
        console.error("Error liking post:", error);
        showInfoBar(error.message || "Failed to like post", "error");
      }
    },
    [token, showInfoBar],
  );

  const handleComment = useCallback(
    (postId: string) => {
      if (!token) {
        showInfoBar("Please login to comment", "info");
        return;
      }
      router.push({
        pathname: "/components/Feed/Comment/CommentsScreen",
        params: { postId },
      });
    },
    [token, router, showInfoBar],
  );

  const handleShare = useCallback(
    (postId: string) => {
      showInfoBar("Share feature coming soon!", "info");
    },
    [showInfoBar],
  );

  const handleEditPost = useCallback(
    (postId: string) => {
      router.push({
        pathname: "/components/Feed/Post/EditPost",
        params: { postId },
      });
    },
    [router],
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        await deletePost(postId);
        setPosts((prev) => prev.filter((post) => post._id !== postId));
        showInfoBar("Post deleted successfully", "success");
      } catch (error: any) {
        console.error("Error deleting post:", error);
        showInfoBar(error.message || "Failed to delete post", "error");
      }
    },
    [showInfoBar],
  );

  const handleSavePost = useCallback(
    (postId: string) => {
      setSavedPosts((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(postId)) {
          newSet.delete(postId);
          showInfoBar("Post removed from your saved items", "info");
        } else {
          newSet.add(postId);
          showInfoBar("Post added to your saved items", "success");
        }
        return newSet;
      });
    },
    [showInfoBar],
  );

  const handleReportPost = useCallback(
    (postId: string) => {
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, isReported: true } : p)),
      );
      showInfoBar("Thank you for reporting this post", "success");
    },
    [showInfoBar],
  );

  const handleHidePost = useCallback(
    (postId: string) => {
      setHiddenPosts((prev) => new Set(prev).add(postId));
      setPosts((prev) => prev.filter((post) => post._id !== postId));
      showInfoBar("Post hidden, you won't see this post anymore", "info");
    },
    [showInfoBar],
  );

  const handleCopyLink = useCallback(
    (postId: string) => {
      showInfoBar("Post link copied to clipboard", "success");
    },
    [showInfoBar],
  );

  const handleMuteUser = useCallback(
    (userId: string) => {
      setMutedUsers((prev) => new Set(prev).add(userId));
      setPosts((prev) => prev.filter((post) => post.user?._id !== userId));
      showInfoBar(
        "User muted, you won't see posts from this user anymore",
        "info",
      );
    },
    [showInfoBar],
  );

  const handleBlockUser = useCallback(
    async (userId: string) => {
      if (!token || !userId) return;

      setBlockedUsers((prev) => new Set(prev).add(userId));
      setPosts((prev) => prev.filter((post) => post.user?._id !== userId));
      showInfoBar("User blocked successfully", "info");

      try {
        const response = await toggleBlockUser(userId);
        if (response.blocked) {
          setIsBlocked(true);
          setProfileBlocked(true);
        }
      } catch (error: any) {
        setBlockedUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);
          return newSet;
        });
        showInfoBar(error.message || "Failed to block user", "error");
      }
    },
    [token, showInfoBar],
  );

  const handleCancelConnectionRequest = useCallback(async () => {
    if (!profile) return;
    setConnectionLoading(true);

    try {
      const cancelResponse = await connectionService.cancelConnectionRequest(
        profile.user._id,
      );
      if (cancelResponse.success) {
        setConnectionStatus("not_connected");
        showInfoBar(
          `Rejected connection request from ${profile.fullName}`,
          "info",
        );
      } else {
        showInfoBar(
          cancelResponse.message || "Failed to cancel request",
          "error",
        );
      }
    } catch (error: any) {
      console.error("Error canceling request:", error);
      showInfoBar(error.message || "Failed to cancel request", "error");
    } finally {
      setConnectionLoading(false);
    }
  }, [profile, showInfoBar]);

  const handleConnectionAction = useCallback(async () => {
    if (!profile) return;

    if (connectionStatus === "connected") {
      Alert.alert(
        "Remove Connection",
        `Are you sure you want to remove your connection with ${profile.fullName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setConnectionLoading(true);
              try {
                const removeResponse = await connectionService.removeConnection(
                  profile.user._id,
                );
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
                  setPosts([]);
                  await refreshCurrentUserProfile();
                  showInfoBar(
                    `Removed connection with ${profile.fullName}`,
                    "info",
                  );
                } else {
                  showInfoBar(
                    removeResponse.message || "Failed to remove connection",
                    "error",
                  );
                }
              } catch (error: any) {
                showInfoBar(
                  error.message || "Failed to remove connection",
                  "error",
                );
              } finally {
                setConnectionLoading(false);
              }
            },
          },
        ],
      );
      return;
    }

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
              showInfoBar(`Connected with ${profile.fullName}!`, "success");
            } else {
              setConnectionStatus("pending_sent");
              showInfoBar(
                `Connection request sent to ${profile.fullName}`,
                "success",
              );
            }
          } else {
            showInfoBar(
              sendResponse.message || "Failed to send request",
              "error",
            );
          }
          break;
        case "pending_sent":
          const cancelResponse =
            await connectionService.cancelConnectionRequest(profile.user._id);
          if (cancelResponse.success) {
            setConnectionStatus("not_connected");
            showInfoBar("Connection request cancelled", "info");
          } else {
            showInfoBar(
              cancelResponse.message || "Failed to cancel request",
              "error",
            );
          }
          break;
        case "pending_received":
          const acceptResponse =
            await connectionService.acceptConnectionRequest(profile.user._id);
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
            showInfoBar(`Connected with ${profile.fullName}!`, "success");
          } else {
            showInfoBar(
              acceptResponse.message || "Failed to accept request",
              "error",
            );
          }
          break;
      }
    } catch (error: any) {
      showInfoBar(error.message || "Failed to process request", "error");
    } finally {
      setConnectionLoading(false);
    }
  }, [
    profile,
    connectionStatus,
    refreshCurrentUserProfile,
    loadProfilePosts,
    showInfoBar,
  ]);

  const loadMorePosts = useCallback(() => {
    if (
      !postsLoading &&
      hasMorePosts &&
      token &&
      connectionStatus === "connected"
    ) {
      loadProfilePosts(postsPage + 1, true);
    }
  }, [
    postsLoading,
    hasMorePosts,
    token,
    connectionStatus,
    postsPage,
    loadProfilePosts,
  ]);

  // Derived values - safe to compute after all hooks
  const getConnectionButtonConfig = useCallback(() => {
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
  }, [connectionStatus]);

  const buttonConfig = getConnectionButtonConfig();

  const getButtonStyle = useCallback(() => {
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
  }, [buttonConfig.style]);

  const formattedUser = profile
    ? {
        _id: profile.user._id,
        name: profile.fullName,
        email: profile.user.email,
        username: profile.username,
        profileComplete: profile.user.profileComplete,
      }
    : null;

  // Render functions - safe to define after all hooks
  const renderInfoBar = useCallback(() => {
    if (!infoMessage) return null;
    const bg =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : "#8b5cf6";
    const icon =
      infoType === "success"
        ? "checkmark-circle"
        : infoType === "error"
          ? "alert-circle"
          : "information-circle";
    return (
      <Animated.View
        style={[
          publicStyles.infoBar,
          { backgroundColor: bg, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <Ionicons name={icon} size={20} color="#fff" />
        <Text style={publicStyles.infoBarText}>{infoMessage}</Text>
      </Animated.View>
    );
  }, [infoMessage, infoType, slideAnim]);

  const renderPost = useCallback(
    ({ item }: { item: Post }) => (
      <View style={publicStyles.postCardContainer}>
        <PostCard
          post={item}
          onLikePress={handleLike}
          onCommentPress={handleComment}
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
    ),
    [
      handleLike,
      handleComment,
      handleShare,
      handleEditPost,
      handleDeletePost,
      handleSavePost,
      handleReportPost,
      handleHidePost,
      handleCopyLink,
      handleMuteUser,
      handleBlockUser,
    ],
  );

  const renderPostsSection = useCallback(() => {
    if (!profile) return null;

    if (isOwnProfile) {
      if (initialPostsLoading) {
        return <InitialPostsSkeleton />;
      }
      return (
        <>
          <ProfileInfo profile={profile} user={profile.user} />
          <ProfileStats
            stats={{
              posts: profile.stats?.posts || 0,
              connections: profile.stats?.connections || 0,
              groups: profile.stats?.groups || 0,
            }}
          />
          <View style={publicStyles.postsHeader}>
            <Text style={publicStyles.postsTitle}>Posts</Text>
          </View>
        </>
      );
    }

    if (connectionStatus === "connected") {
      if (initialPostsLoading) {
        return <InitialPostsSkeleton />;
      }
      return (
        <>
          <ProfileInfo profile={profile} user={profile.user} />
          <ProfileStats
            stats={{
              posts: profile.stats?.posts || 0,
              connections: profile.stats?.connections || 0,
              groups: profile.stats?.groups || 0,
            }}
          />
          <View style={publicStyles.postsHeader}>
            <Text style={publicStyles.postsTitle}>Posts</Text>
          </View>
        </>
      );
    } else {
      return (
        <>
          <ProfileInfo profile={profile} user={profile.user} />
          <ProfileStats
            stats={{
              posts: profile.stats?.posts || 0,
              connections: profile.stats?.connections || 0,
              groups: profile.stats?.groups || 0,
            }}
          />
          <View style={publicStyles.privatePostsContainer}>
            <Text style={publicStyles.privatePostsTitle}>
              Posts are private
            </Text>
            <Text style={publicStyles.privatePostsText}>
              Connect with {profile.fullName} to see their posts and updates.
            </Text>
            <TouchableOpacity
              style={publicStyles.connectPromptButton}
              onPress={handleConnectionAction}
              disabled={connectionLoading}
            >
              {connectionLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={20} color="#fff" />
                  <Text style={publicStyles.connectPromptButtonText}>
                    {connectionStatus === "pending_sent"
                      ? "Request Sent"
                      : connectionStatus === "pending_received"
                        ? "Accept Request"
                        : "Connect to View Posts"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </>
      );
    }
  }, [
    profile,
    isOwnProfile,
    connectionStatus,
    initialPostsLoading,
    connectionLoading,
    handleConnectionAction,
  ]);

  // ============================================
  // HEADER RENDER HELPER
  // ============================================
  const renderHeader = useCallback(
    (title: string, showOptions: boolean = true) => (
      <View style={publicStyles.header}>
        <TouchableOpacity onPress={goBack} style={publicStyles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={publicStyles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {!isOwnProfile && showOptions ? (
          <TouchableOpacity
            onPress={() => setShowOptionsModal(true)}
            style={{ width: 40, alignItems: "flex-end", padding: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={24} color="#111827" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>
    ),
    [goBack, isOwnProfile],
  );

  // ============================================
  // BLOCKED STATE - Render blocked UI
  // ============================================
  if (profileBlocked) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        {renderHeader(isBlockedByOwner ? "Blocked" : "Profile")}

        <View style={publicStyles.blockedContainer}>
          <Ionicons
            name={isBlockedByOwner ? "ban-outline" : "person-remove-outline"}
            size={80}
            color="#ef4444"
          />
          <Text style={publicStyles.blockedTitle}>
            {isBlockedByOwner ? "You've been blocked" : "Profile not available"}
          </Text>
          <Text style={publicStyles.blockedText}>
            {isBlockedByOwner
              ? "This user has blocked you. You cannot view their profile or interact with them."
              : "You have blocked this user. Unblock them to view their profile."}
          </Text>
          <TouchableOpacity style={publicStyles.blockedButton} onPress={goBack}>
            <Text style={publicStyles.blockedButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>

        {/* Show options modal even in blocked state */}
        {!isOwnProfile && profile && (
          <ProfileOptionsModal
            visible={showOptionsModal}
            onClose={() => setShowOptionsModal(false)}
            userId={profile.user._id}
            userName={profile.fullName}
            isBlocked={isBlocked}
            isMuted={mutedUsers.has(profile.user._id)}
            onBlockUser={() => {
              setIsBlocked(true);
              setProfileBlocked(true);
              setBlockedUsers((prev: Set<string>) => {
                const newSet = new Set<string>(prev);
                newSet.add(profile.user._id);
                return newSet;
              });
              showInfoBar("User blocked successfully", "success");
            }}
            // Unblock user
            onUnblockUser={() => {
              setIsBlocked(false);
              setProfileBlocked(false);
              setBlockedUsers((prev: Set<string>) => {
                const newSet = new Set<string>(prev);
                newSet.delete(profile.user._id);
                return newSet;
              });
              showInfoBar("User unblocked successfully", "success");
              setTimeout(() => loadProfile(), 500);
            }}
            // Report success
            onReportSuccess={() => {
              setReportedUsers((prev: Set<string>) => {
                const newSet = new Set<string>(prev);
                newSet.add(profile.user._id);
                return newSet;
              });
              showInfoBar(
                "Report submitted. Thank you for your feedback.",
                "success",
              );
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ============================================
  // INITIAL LOADING STATE
  // ============================================
  if (initialLoading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ProfileSkeleton isOwnProfile={isOwnProfile} />
      </SafeAreaView>
    );
  }

  // ============================================
  // PROFILE NOT FOUND STATE
  // ============================================
  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noProfileContainer}>
          <Ionicons name="person-circle-outline" size={100} color="#d1d5db" />
          <Text style={styles.noProfileTitle}>Profile Not Found</Text>
          <Text style={styles.noProfileDescription}>
            The profile you're looking for doesn't exist or has been removed.
          </Text>
          <TouchableOpacity style={styles.setupButton} onPress={goBack}>
            <Ionicons name="arrow-back" size={20} color="white" />
            <Text style={styles.setupButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // MAIN PROFILE RENDER
  // ============================================
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {renderHeader(profile.fullName)}

      <FlatList
        data={connectionStatus === "connected" || isOwnProfile ? posts : []}
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
            {formattedUser && (
              <ProfileHeader
                user={formattedUser}
                profile={profile}
                uploading={false}
                coverUploading={false}
                onImagePress={() => {}}
                onCoverPhotoPress={() => {}}
                isPublicView={true}
              />
            )}
            <View style={styles.content}>
              {!isOwnProfile && (
                <View style={publicStyles.connectionButtonContainer}>
                  {connectionStatus === "pending_received" ? (
                    <View style={publicStyles.acceptCancelContainer}>
                      <TouchableOpacity
                        style={[
                          publicStyles.connectionButton,
                          publicStyles.acceptButton,
                        ]}
                        onPress={handleConnectionAction}
                        disabled={connectionLoading}
                      >
                        {connectionLoading ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons
                              name="checkmark-circle"
                              size={18}
                              color="#fff"
                            />
                            <Text style={publicStyles.connectionButtonText}>
                              Accept
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={publicStyles.cancelButton}
                        onPress={handleCancelConnectionRequest}
                        disabled={connectionLoading}
                      >
                        <Ionicons
                          name="close-circle"
                          size={32}
                          color="#ef4444"
                        />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={publicStyles.buttonsRow}>
                      <TouchableOpacity
                        style={[
                          publicStyles.connectionButton,
                          getButtonStyle(),
                          publicStyles.flexButton,
                        ]}
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
                      <TouchableOpacity
                        style={[
                          publicStyles.connectionButton,
                          publicStyles.messageButton,
                          publicStyles.flexButton,
                        ]}
                        onPress={startChat}
                      >
                        <Ionicons
                          name="chatbubble-outline"
                          size={20}
                          color="#fff"
                        />
                        <Text style={publicStyles.connectionButtonText}>
                          Message
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}

              {renderPostsSection()}
            </View>
          </>
        }
        ListFooterComponent={
          loadingMorePosts &&
          (connectionStatus === "connected" || isOwnProfile) ? (
            <View style={publicStyles.loadingMoreContainer}>
              <LoadingMorePostsSkeleton />
            </View>
          ) : null
        }
        ListEmptyComponent={
          !initialPostsLoading &&
          (connectionStatus === "connected" || isOwnProfile) &&
          posts.length === 0 ? (
            <View style={publicStyles.emptyPostsContainer}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color="#d1d5db"
              />
              <Text style={publicStyles.emptyPostsTitle}>No posts yet</Text>
              <Text style={publicStyles.emptyPostsText}>
                {viewerStatus.isConnected
                  ? "This user hasn't posted anything yet."
                  : "Be the first to connect and see their posts!"}
              </Text>
            </View>
          ) : null
        }
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.3}
      />

      {renderInfoBar()}

      {/* Profile Options Modal */}
      {!isOwnProfile && profile && (
        <ProfileOptionsModal
          visible={showOptionsModal}
          onClose={() => setShowOptionsModal(false)}
          userId={profile.user._id}
          userName={profile.fullName}
          isBlocked={isBlocked}
          isMuted={mutedUsers.has(profile.user._id)}
          isReported={reportedUsers.has(profile.user._id)}
          onBlockUser={() => {
            setIsBlocked(true);
            setProfileBlocked(true);
            setBlockedUsers((prev) => new Set(prev).add(profile.user._id));
            showInfoBar("User blocked successfully", "success");
          }}
          onUnblockUser={() => {
            setIsBlocked(false);
            setProfileBlocked(false);
            setBlockedUsers((prev) => {
              const newSet = new Set(prev);
              newSet.delete(profile.user._id);
              return newSet;
            });
            showInfoBar("User unblocked successfully", "success");
            // Reload profile after unblock
            setTimeout(() => loadProfile(), 500);
          }}
          onMuteUser={() => {
            setMutedUsers((prev) => new Set(prev).add(profile.user._id));
            showInfoBar("User muted successfully", "info");
          }}
          onUnmuteUser={() => {
            setMutedUsers((prev) => {
              const newSet = new Set(prev);
              newSet.delete(profile.user._id);
              return newSet;
            });
            showInfoBar("User unmuted successfully", "info");
          }}
          onReportSuccess={() => {
            showInfoBar(
              "Report submitted. Thank you for your feedback.",
              "success",
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

// Keep all existing style definitions exactly as they were
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
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
    textAlign: "center",
  },
  infoBar: {
    position: "absolute",
    bottom: 50,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    zIndex: 1000,
  },
  infoBarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    textAlign: "left",
    lineHeight: 20,
  },
  connectionButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: 12,
  },
  flexButton: {
    flex: 1,
  },
  connectionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  connectionButton_connect: {
    backgroundColor: "#8b5cf6",
  },
  connectionButton_pending: {
    backgroundColor: "#f59e0b",
  },
  connectionButton_accept: {
    backgroundColor: "#10b981",
  },
  connectionButton_connected: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#10b981",
  },
  connectionButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "SofiaSans-Bold",
    fontWeight: "600",
  },
  connectedButtonText: {
    color: "#10b981",
  },
  messageButton: {
    backgroundColor: "#3b82f6",
  },
  acceptCancelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: "#10b981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  cancelButton: {
    padding: 4,
    borderRadius: 20,
  },
  postsHeader: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  postsTitle: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "SofiaSans-Bold",
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
    padding: 16,
    marginBottom: 8,
  },
  loadingMoreContainer: {
    paddingHorizontal: 0,
    paddingTop: 0,
  },
  privatePostsContainer: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: "#f9fafb",
    marginHorizontal: 20,
    borderRadius: 16,
    marginTop: 20,
  },
  privatePostsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    fontFamily: "SofiaSans-Bold",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  privatePostsText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  connectPromptButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8b5cf6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    gap: 8,
  },
  connectPromptButtonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "SofiaSans-Bold",
    fontWeight: "600",
  },
  blockedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  blockedTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 20,
    marginBottom: 12,
    textAlign: "center",
    fontFamily: "SofiaSans-Bold",
  },
  blockedText: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 24,
    fontFamily: "SofiaSans-Regular",
  },
  blockedButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  blockedButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
});
