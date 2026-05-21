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
import { useTheme } from "../../lib/contexts/ThemeContext";
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
  const { colors } = useTheme();

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

  useFocusEffect(
    useCallback(() => {
      if (token) loadProfile();
    }, [id, token]),
  );

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
      const mutedResponse = await profileService.getMutedUsers(1, 50);
      if (mutedResponse.success && mutedResponse.data) {
        const mutedIds = new Set<string>(
          mutedResponse.data.users.map((u: any) =>
            String(u._id || u.user?._id || ""),
          ),
        );
        mutedIds.delete("");
        setMutedUsers(mutedIds);
      }
    } catch (error) {
      console.error("Error loading user states:", error);
    }
  }, [token, isOwnProfile]);

  const loadProfilePosts = useCallback(
    async (
      page = 1,
      shouldAppend = false,
      forceConnectionStatus?: ConnectionStatus,
    ) => {
      if (!id || postsLoading) return;
      const effectiveStatus = forceConnectionStatus ?? connectionStatus;
      if (!isOwnProfile && effectiveStatus !== "connected") {
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
          await loadProfilePosts(1, false, "connected");
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
      if (response.isBlocked || response.isBlockedByOwner) {
        setProfileBlocked(true);
        setIsBlocked(response.isBlocked || false);
        setIsBlockedByOwner(response.isBlockedByOwner || false);
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
              socialLinks: { instagram: "", linkedin: "", github: "" },
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
        } else await loadProfilePosts(1, false, "connected");
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
        router.push({
          pathname: "/screens/ChatScreen",
          params: {
            roomId: data.data.roomId,
            otherUserName: profile.fullName,
            otherUserId: profile.user._id,
            otherUserAvatar: profile.profilePicture || "",
            isGroup: "false",
          },
        });
      } else {
        showInfoBar(data.message || "Failed to start chat", "error");
      }
    } catch (error) {
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
      console.error("Error refreshing:", error);
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
        setPosts((prev) =>
          prev.map((post) =>
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
  const handleShare = useCallback(() => {
    showInfoBar("Share feature coming soon!", "info");
  }, [showInfoBar]);
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
        showInfoBar(error.message || "Failed to delete post", "error");
      }
    },
    [showInfoBar],
  );
  const handleSavePost = useCallback(
    (postId: string) => {
      setSavedPosts((prev) => {
        const newSet = new Set(prev);
        newSet.has(postId) ? newSet.delete(postId) : newSet.add(postId);
        showInfoBar(
          newSet.has(postId) ? "Post saved" : "Post removed from saved",
          "info",
        );
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
      showInfoBar("Post hidden", "info");
    },
    [showInfoBar],
  );
  const handleCopyLink = useCallback(() => {
    showInfoBar("Link copied to clipboard", "success");
  }, [showInfoBar]);
  const handleMuteUser = useCallback(
    (userId: string) => {
      setMutedUsers((prev) => new Set(prev).add(userId));
      setPosts((prev) => prev.filter((post) => post.user?._id !== userId));
      showInfoBar("User muted", "info");
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
        showInfoBar(`Rejected request from ${profile.fullName}`, "info");
      } else {
        showInfoBar(cancelResponse.message || "Failed", "error");
      }
    } catch (error: any) {
      showInfoBar(error.message || "Failed", "error");
    } finally {
      setConnectionLoading(false);
    }
  }, [profile, showInfoBar]);

  const handleConnectionAction = useCallback(async () => {
    if (!profile) return;
    if (connectionStatus === "connected") {
      Alert.alert(
        "Remove Connection",
        `Remove connection with ${profile.fullName}?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              setConnectionLoading(true);
              try {
                const res = await connectionService.removeConnection(
                  profile.user._id,
                );
                if (res.success) {
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
                  showInfoBar(res.message || "Failed", "error");
                }
              } catch (error: any) {
                showInfoBar(error.message || "Failed", "error");
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
        case "not_connected": {
          const res = await connectionService.sendConnectionRequest(
            profile.user._id,
          );
          if (res.success) {
            if (res.data?.autoAccepted || res.data?.status === "connected") {
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
              await loadProfilePosts(1, false, "connected");
              showInfoBar(`Connected with ${profile.fullName}!`, "success");
            } else {
              setConnectionStatus("pending_sent");
              showInfoBar(`Request sent to ${profile.fullName}`, "success");
            }
          } else {
            showInfoBar(res.message || "Failed", "error");
          }
          break;
        }
        case "pending_sent": {
          const res = await connectionService.cancelConnectionRequest(
            profile.user._id,
          );
          if (res.success) {
            setConnectionStatus("not_connected");
            showInfoBar("Request cancelled", "info");
          } else {
            showInfoBar(res.message || "Failed", "error");
          }
          break;
        }
        case "pending_received": {
          const res = await connectionService.acceptConnectionRequest(
            profile.user._id,
          );
          if (res.success) {
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
            await loadProfilePosts(1, false, "connected");
            showInfoBar(`Connected with ${profile.fullName}!`, "success");
          } else {
            showInfoBar(res.message || "Failed", "error");
          }
          break;
        }
      }
    } catch (error: any) {
      showInfoBar(error.message || "Failed", "error");
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

  // ============ RENDER HELPERS ============

  const renderInfoBar = useCallback(() => {
    if (!infoMessage) return null;
    const bg =
      infoType === "success"
        ? "#10b981"
        : infoType === "error"
          ? "#ef4444"
          : colors.primary;
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
  }, [infoMessage, infoType, slideAnim, colors]);

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
      if (initialPostsLoading) return <InitialPostsSkeleton />;
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
            <Text style={[publicStyles.postsTitle, { color: colors.text }]}>
              Posts
            </Text>
          </View>
        </>
      );
    }
    if (connectionStatus === "connected") {
      if (initialPostsLoading) return <InitialPostsSkeleton />;
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
            <Text style={[publicStyles.postsTitle, { color: colors.text }]}>
              Posts
            </Text>
          </View>
        </>
      );
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
        <View
          style={[
            publicStyles.privatePostsContainer,
            { backgroundColor: colors.skeleton },
          ]}
        >
          <Text
            style={[publicStyles.privatePostsTitle, { color: colors.text }]}
          >
            Posts are private
          </Text>
          <Text
            style={[
              publicStyles.privatePostsText,
              { color: colors.textSecondary },
            ]}
          >
            Connect with {profile.fullName} to see their posts and updates.
          </Text>
          <TouchableOpacity
            style={[
              publicStyles.connectPromptButton,
              { backgroundColor: colors.primary },
            ]}
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
  }, [
    profile,
    isOwnProfile,
    connectionStatus,
    initialPostsLoading,
    connectionLoading,
    handleConnectionAction,
    colors,
  ]);

  const renderHeader = useCallback(
    (title: string, showOptions: boolean = true) => (
      <View
        style={[
          publicStyles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={goBack} style={publicStyles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text
          style={[publicStyles.headerTitle, { color: colors.text }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!isOwnProfile && showOptions ? (
          <TouchableOpacity
            onPress={() => setShowOptionsModal(true)}
            style={{ width: 40, alignItems: "flex-end", padding: 8 }}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>
    ),
    [goBack, isOwnProfile, colors],
  );

  // ============ BLOCKED STATE ============
  if (profileBlocked) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        {renderHeader(isBlockedByOwner ? "Blocked" : "Profile")}
        <View style={publicStyles.blockedContainer}>
          <Ionicons
            name={isBlockedByOwner ? "ban-outline" : "person-remove-outline"}
            size={80}
            color="#ef4444"
          />
          <Text style={[publicStyles.blockedTitle, { color: colors.text }]}>
            {isBlockedByOwner ? "You've been blocked" : "Profile not available"}
          </Text>
          <Text
            style={[publicStyles.blockedText, { color: colors.textSecondary }]}
          >
            {isBlockedByOwner
              ? "This user has blocked you."
              : "You have blocked this user."}
          </Text>
          <TouchableOpacity
            style={[
              publicStyles.blockedButton,
              { backgroundColor: colors.primary },
            ]}
            onPress={goBack}
          >
            <Text style={publicStyles.blockedButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
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
              setBlockedUsers((prev) => new Set(prev).add(profile.user._id));
              showInfoBar("User blocked", "success");
            }}
            onUnblockUser={() => {
              setIsBlocked(false);
              setProfileBlocked(false);
              setBlockedUsers((prev) => {
                const ns = new Set(prev);
                ns.delete(profile.user._id);
                return ns;
              });
              showInfoBar("User unblocked", "success");
              setTimeout(() => loadProfile(), 500);
            }}
            onReportSuccess={() => {
              setReportedUsers((prev) => new Set(prev).add(profile.user._id));
              showInfoBar("Report submitted", "success");
            }}
          />
        )}
      </SafeAreaView>
    );
  }

  // ============ INITIAL LOADING ============
  if (initialLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <ProfileSkeleton isOwnProfile={isOwnProfile} />
      </SafeAreaView>
    );
  }

  // ============ NOT FOUND ============
  if (!profile) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.noProfileContainer}>
          <Ionicons
            name="person-circle-outline"
            size={100}
            color={colors.textMuted}
          />
          <Text style={[styles.noProfileTitle, { color: colors.text }]}>
            Profile Not Found
          </Text>
          <Text
            style={[
              styles.noProfileDescription,
              { color: colors.textSecondary },
            ]}
          >
            The profile you're looking for doesn't exist.
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.primary }]}
            onPress={goBack}
          >
            <Ionicons name="arrow-back" size={20} color="white" />
            <Text style={styles.setupButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============ MAIN RENDER ============
  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={["top"]}
    >
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
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.card}
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
                color={colors.textMuted}
              />
              <Text
                style={[publicStyles.emptyPostsTitle, { color: colors.text }]}
              >
                No posts yet
              </Text>
              <Text
                style={[
                  publicStyles.emptyPostsText,
                  { color: colors.textSecondary },
                ]}
              >
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
            showInfoBar("User blocked", "success");
          }}
          onUnblockUser={() => {
            setIsBlocked(false);
            setProfileBlocked(false);
            setBlockedUsers((prev) => {
              const ns = new Set(prev);
              ns.delete(profile.user._id);
              return ns;
            });
            showInfoBar("User unblocked", "success");
            setTimeout(() => loadProfile(), 500);
          }}
          onMuteUser={() => {
            setMutedUsers((prev) => new Set(prev).add(profile.user._id));
            showInfoBar("User muted", "info");
          }}
          onUnmuteUser={() => {
            setMutedUsers((prev) => {
              const ns = new Set(prev);
              ns.delete(profile.user._id);
              return ns;
            });
            showInfoBar("User unmuted", "info");
          }}
          onReportSuccess={() => {
            showInfoBar("Report submitted", "success");
          }}
        />
      )}
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
  connectionButtonContainer: { paddingHorizontal: 20, marginBottom: 16 },
  buttonsRow: { flexDirection: "row", gap: 12 },
  flexButton: { flex: 1 },
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
  connectionButtonText: {
    color: "white",
    fontSize: 16,
    fontFamily: "SofiaSans-Bold",
    fontWeight: "600",
  },
  connectedButtonText: { color: "#10b981" },
  messageButton: { backgroundColor: "#3b82f6" },
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
  cancelButton: { padding: 4, borderRadius: 20 },
  postsHeader: { marginTop: 16, paddingHorizontal: 20 },
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
  footerLoader: { paddingVertical: 20 },
  flatListContent: { paddingBottom: 20 },
  postCardContainer: { padding: 16, marginBottom: 8 },
  loadingMoreContainer: { paddingHorizontal: 0, paddingTop: 0 },
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
