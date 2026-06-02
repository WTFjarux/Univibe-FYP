// app/(tabs)/profile/index.tsx

import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  RefreshControl,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useRouter, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { useAuth } from "../../../lib/contexts/AuthContext";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { useImageUpload } from "../../../hooks/useImageUpload";
import { useCoverPhotoUpload } from "../../../hooks/useCoverPhotoUpload";
import { connectionService } from "../../../lib/services/connectionService";
import {
  getProfilePosts,
  toggleLike,
  deletePost,
  restorePost,
  Post,
  getFullImageUrl,
  toggleBlockUser,
} from "../../../lib/services/postService";
import {
  toggleSavePost,
  hidePost,
  unhidePost,
  toggleMuteUser,
  reportContent,
} from "../../../lib/services/contentService";
import { API_BASE_URL } from "../../../constants/ipConstants";
import { profileCache } from "../../../lib/cache/profileCache";

import ProfileHeader from "@/app/components/Profile/ProfileHeader";
import ProfileInfo from "@/app/components/Profile/ProfileInfo";
import ProfileStats from "@/app/components/Profile/ProfileStats";
import ProfileTabs from "@/app/components/Profile/ProfileTabs";
import ProfilePosts from "@/app/components/Profile/ProfilePosts";
import UploadModal from "@/app/components/Profile/UploadModal";
import ImageViewModal from "@/app/components/Profile/ImageViewModal";
import SettingsScreen from "@/app/settings";
import SharePostModal from "@/app/components/Feed/Post/SharePostModal";
import ReportModal from "@/app/components/ReportModal";
import { styles } from "@/app/components/Profile/profileStyles";
import OwnProfilePageSkeleton, {
  OwnPostsLoadingSkeleton,
  OwnLoadingMorePostsSkeleton,
} from "@/app/components/Profile/OwnProfileSkeleton";

// ============================================
// TYPES
// ============================================

type TabType = "posts" | "about";

interface UndoAction {
  type: "mute" | "block" | "hide" | "save" | "delete";
  userId?: string;
  postId?: string;
  post?: Post;
  userName?: string;
  deletedPost?: Post;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

const getAuthToken = async (): Promise<string | null> => {
  try {
    return await SecureStore.getItemAsync("authToken");
  } catch (error) {
    return null;
  }
};

// Enable layout animations for Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Memoized components for performance
const MemoizedProfilePosts = React.memo(ProfilePosts);

// ============================================
// MAIN COMPONENT
// ============================================

export default function ProfileScreen() {
  // ============================================
  // AUTH & THEME HOOKS
  // ============================================
  const {
    user,
    profile,
    isLoading: authLoading,
    logout,
    loadProfile,
    refreshUserProfile,
    token,
  } = useAuth();
  const { colors, isDark } = useTheme();
  const router = useRouter();

  // ============================================
  // LOCAL STATE - Profile Data
  // ============================================
  const [postCount, setPostCount] = useState(0);
  const [connectionCount, setConnectionCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("about");
  const [showSettings, setShowSettings] = useState(false);

  // ============================================
  // LOCAL STATE - Posts Management
  // ============================================
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [postsRefreshing, setPostsRefreshing] = useState(false);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [postsInitialLoading, setPostsInitialLoading] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [isCached, setIsCached] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // ============================================
  // LOCAL STATE - Modals
  // ============================================
  // Share Modal
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharePost, setSharePost] = useState<Post | null>(null);

  // Report Modal
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportTargetId, setReportTargetId] = useState("");
  const [reportTargetType, setReportTargetType] = useState<
    "Post" | "Comment" | "User" | "Event"
  >("Post");

  // Options Modal (for tracking)
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);

  // ============================================
  // REFS
  // ============================================
  const isMounted = useRef(true);
  const refreshInProgress = useRef(false);
  const initialLoadDone = useRef(false);
  const mainScrollViewRef = useRef<ScrollView>(null);
  const pickerActiveRef = useRef(false);

  // ============================================
  // IMAGE UPLOAD HOOKS
  // ============================================
  const {
    uploadModal,
    viewPhotoModal,
    uploading,
    openUploadModal,
    closeUploadModal,
    openImageViewer,
    closeImageViewer,
    uploadProfileImage,
    deleteProfileImage,
  } = useImageUpload();

  const {
    coverModal,
    coverViewModal,
    coverUploading,
    openCoverModal,
    closeCoverModal,
    openCoverImageViewer,
    closeCoverImageViewer,
    uploadCoverPhoto,
    deleteCoverPhoto,
  } = useCoverPhotoUpload();

  // ============================================
  // LIFECYCLE - Mount/Unmount
  // ============================================
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // ============================================
  // TAB HANDLING
  // ============================================
  const handleTabChange = useCallback(
    (tab: TabType) => {
      if (tab === activeTab) return;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveTab(tab);
      // Fetch posts when switching to posts tab and not loaded
      if (tab === "posts" && !postsLoaded && user?.id && !postsLoading) {
        fetchUserPosts(1, false);
      }
    },
    [activeTab, postsLoaded, user?.id, postsLoading],
  );

  // ============================================
  // DATA FETCHING - Post Count
  // ============================================
  const fetchPostCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cacheKey = `post_count_${user.id}`;
      const cached = profileCache.getFromMemory(cacheKey);
      if (cached && isMounted.current) setPostCount(cached);

      const token = await getAuthToken();
      const response = await fetch(
        `${API_BASE_URL}/api/posts/user/${user.id}/count`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (data.success && isMounted.current) {
        setPostCount(data.count);
        profileCache.saveToMemory(cacheKey, data.count);
      }
    } catch (error) {
      console.error("Error fetching post count:", error);
    }
  }, [user?.id]);

  // ============================================
  // DATA FETCHING - Connection Count
  // ============================================
  const fetchConnectionCount = useCallback(async () => {
    if (!user?.id) return;
    try {
      const cacheKey = `connection_count_${user.id}`;
      const cached = profileCache.getFromMemory(cacheKey);
      if (cached && isMounted.current) setConnectionCount(cached);

      const response = await connectionService.getConnectionCount(user.id);
      if (response.success && response.data && isMounted.current) {
        setConnectionCount(response.data.connectionCount);
        profileCache.saveToMemory(cacheKey, response.data.connectionCount);
      }
    } catch (error) {
      console.error("Error fetching connection count:", error);
    }
  }, [user?.id]);

  // ============================================
  // DATA FETCHING - User Posts
  // ============================================
  const fetchUserPosts = useCallback(
    async (page = 1, shouldAppend = false, forceRefresh = false) => {
      if (!user?.id) return;
      if (postsLoading && !forceRefresh) return;

      const cacheKey = `user_posts_${user.id}_page_${page}`;

      // Set loading states
      if (shouldAppend) setLoadingMorePosts(true);
      else if (!forceRefresh) setPostsInitialLoading(true);
      setPostsLoading(true);

      // Check cache for first page
      if (
        !forceRefresh &&
        page === 1 &&
        !shouldAppend &&
        posts.length === 0 &&
        !postsLoading
      ) {
        const cached = profileCache.getFromMemory(cacheKey);
        if (
          cached &&
          cached.posts &&
          cached.posts.length > 0 &&
          isMounted.current
        ) {
          setPosts(cached.posts);
          setHasMorePosts(cached.hasMore);
          setPostsPage(page);
          setPostsLoaded(true);
          setIsCached(true);
          setPostsInitialLoading(false);
          setPostsLoading(false);
          return;
        }
      }

      try {
        const response = await getProfilePosts(user.id, page, 10);
        if (response.success && response.data && isMounted.current) {
          const newPosts = response.data.posts;
          if (shouldAppend) {
            setPosts((prev) => [...prev, ...newPosts]);
          } else {
            setPosts(newPosts);
            // Cache first page results
            if (page === 1) {
              profileCache.saveToMemory(cacheKey, {
                posts: newPosts,
                hasMore: response.data.pagination.pages > page,
              });
            }
          }
          setHasMorePosts(response.data.pagination.pages > page);
          setPostsPage(page);
          setPostsLoaded(true);
          setIsCached(false);
        }
      } catch (error) {
        console.error("Error fetching user posts:", error);
      } finally {
        if (isMounted.current) {
          setPostsLoading(false);
          setPostsRefreshing(false);
          setPostsInitialLoading(false);
          setLoadingMorePosts(false);
        }
      }
    },
    [user?.id, postsLoading, posts.length],
  );

  // ============================================
  // POST ACTIONS - Load More
  // ============================================
  const loadMorePosts = useCallback(() => {
    if (!postsLoading && hasMorePosts && postsLoaded && !postsRefreshing) {
      fetchUserPosts(postsPage + 1, true);
    }
  }, [
    postsLoading,
    hasMorePosts,
    postsLoaded,
    postsRefreshing,
    postsPage,
    fetchUserPosts,
  ]);

  // ============================================
  // POST ACTIONS - Refresh
  // ============================================
  const refreshPosts = useCallback(() => {
    if (postsRefreshing) return;
    setPostsRefreshing(true);
    if (user?.id) profileCache.clear(`user_posts_${user.id}_page_1`);
    fetchUserPosts(1, false, true);
  }, [postsRefreshing, user?.id, fetchUserPosts]);

  // ============================================
  // POST ACTIONS - Like
  // ============================================
  const handleLike = useCallback(
    async (postId: string) => {
      if (!token) {
        Alert.alert("Login Required", "Please login to like posts");
        return;
      }

      // Optimistic update
      const post = posts.find((p) => p._id === postId);
      if (post) {
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId
              ? {
                  ...p,
                  isLiked: !p.isLiked,
                  likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
                }
              : p,
          ),
        );
      }

      try {
        const response = await toggleLike(postId);
        // Sync with server response
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId
              ? { ...p, isLiked: response.isLiked, likeCount: response.likes }
              : p,
          ),
        );
        // Invalidate cache
        if (user?.id) profileCache.clear(`user_posts_${user.id}_page_1`);
      } catch (error: any) {
        // Revert on error
        if (post) {
          setPosts((prev) =>
            prev.map((p) =>
              p._id === postId
                ? { ...p, isLiked: post.isLiked, likeCount: post.likeCount }
                : p,
            ),
          );
        }
        Alert.alert("Error", error.message || "Failed to like post");
      }
    },
    [token, posts, user?.id],
  );

  // ============================================
  // POST ACTIONS - Comment
  // ============================================
  const handleComment = useCallback(
    (postId: string) => {
      router.push({
        pathname: "/components/Feed/Comment/CommentsScreen",
        params: { postId },
      });
    },
    [router],
  );

  // ============================================
  // POST ACTIONS - Share
  // ============================================
  const handleShare = useCallback(
    (postId: string) => {
      if (!token) {
        Alert.alert("Login Required", "Please login to share posts");
        return;
      }
      const post = posts.find((p) => p._id === postId);
      if (post) {
        setSharePost(post);
        setShareModalVisible(true);
      }
    },
    [token, posts],
  );

  // ============================================
  // POST ACTIONS - Edit
  // ============================================
  const handleEditPost = useCallback(
    (postId: string) => {
      router.push({
        pathname: "/components/Feed/Post/EditPost",
        params: { postId },
      });
    },
    [router],
  );

  // ============================================
  // POST ACTIONS - Delete with Undo
  // ============================================
  const handleDeletePost = useCallback(
    async (postId: string) => {
      const postToDelete = posts.find((p) => p._id === postId);
      if (!postToDelete) return;

      // Optimistically remove from UI
      setPosts((prev) => prev.filter((p) => p._id !== postId));
      setPostCount((prev) => Math.max(0, prev - 1));

      // Show undo alert
      Alert.alert(
        "Post Deleted",
        "Your post has been deleted. You can undo this action.",
        [
          { text: "Undo", onPress: () => restoreDeletedPost(postToDelete) },
          { text: "OK", style: "cancel" },
        ],
      );

      try {
        await deletePost(postId);
        if (user?.id) profileCache.clear(`user_posts_${user.id}_page_1`);
      } catch (error: any) {
        // Restore on error
        setPosts((prev) => [...prev, postToDelete]);
        setPostCount((prev) => prev + 1);
        Alert.alert("Error", error.message || "Failed to delete post");
      }
    },
    [posts, user?.id],
  );

  // Helper to restore deleted post
  const restoreDeletedPost = useCallback(
    async (post: Post) => {
      try {
        await restorePost(post._id);
        setPosts((prev) => [...prev, post]);
        setPostCount((prev) => prev + 1);
        if (user?.id) profileCache.clear(`user_posts_${user.id}_page_1`);
        Alert.alert("Success", "Post restored successfully");
      } catch (error: any) {
        Alert.alert("Error", error.message || "Failed to restore post");
      }
    },
    [user?.id],
  );

  // ============================================
  // POST ACTIONS - Save
  // ============================================
  const handleSavePost = useCallback(
    async (postId: string) => {
      if (!token) {
        Alert.alert("Login Required", "Please login to save posts");
        return;
      }

      const post = posts.find((p) => p._id === postId);
      const wasSaved = post?.isSaved;

      // Optimistic update
      setPosts((prev) =>
        prev.map((p) => (p._id === postId ? { ...p, isSaved: !wasSaved } : p)),
      );

      try {
        const response = await toggleSavePost(postId);
        setPosts((prev) =>
          prev.map((p) =>
            p._id === postId ? { ...p, isSaved: response.saved } : p,
          ),
        );
        Alert.alert(
          "Success",
          response.saved ? "Post saved" : "Post removed from saved",
        );
      } catch (error: any) {
        // Revert on error
        setPosts((prev) =>
          prev.map((p) => (p._id === postId ? { ...p, isSaved: wasSaved } : p)),
        );
        Alert.alert("Error", error.message || "Failed to save post");
      }
    },
    [token, posts],
  );

  // ============================================
  // POST ACTIONS - Report
  // ============================================
  const handleReportPost = useCallback(
    (postId: string) => {
      if (!token) {
        Alert.alert("Login Required", "Please login to report posts");
        return;
      }

      const post = posts.find((p) => p._id === postId);
      if (post?.isReported) {
        Alert.alert("Already Reported", "You have already reported this post");
        return;
      }

      setReportTargetId(postId);
      setReportTargetType("Post");
      setReportModalVisible(true);
    },
    [token, posts],
  );

  // ============================================
  // REPORT SUCCESS HANDLER
  // ============================================
  const handleReportSuccess = useCallback(() => {
    if (reportTargetType === "Post" && reportTargetId) {
      setPosts((prev) =>
        prev.map((p) =>
          p._id === reportTargetId ? { ...p, isReported: true } : p,
        ),
      );
    }
  }, [reportTargetType, reportTargetId]);

  // ============================================
  // POST ACTIONS - Hide
  // ============================================
  const handleHidePost = useCallback(
    async (postId: string) => {
      if (!token) {
        Alert.alert("Login Required", "Please login to hide posts");
        return;
      }

      // Optimistically remove from UI
      const hiddenPost = posts.find((p) => p._id === postId);
      setPosts((prev) => prev.filter((p) => p._id !== postId));

      try {
        await hidePost(postId);
        Alert.alert("Post Hidden", "You won't see this post anymore");
      } catch (error: any) {
        // Restore on error
        if (hiddenPost) setPosts((prev) => [...prev, hiddenPost]);
        Alert.alert("Error", error.message || "Failed to hide post");
      }
    },
    [token, posts],
  );

  // ============================================
  // POST ACTIONS - Copy Link
  // ============================================
  const handleCopyLink = useCallback(() => {
    Alert.alert("Link Copied", "Post link copied to clipboard");
  }, []);

  // ============================================
  // POST ACTIONS - Mute User
  // ============================================
  const handleMuteUser = useCallback(
    async (userId: string, userName?: string) => {
      if (!token) return;

      // Remove user's posts from feed
      const postsToRemove = posts.filter((p) => p.user?._id === userId);
      setPosts((prev) => prev.filter((p) => p.user?._id !== userId));

      try {
        await toggleMuteUser(userId);
        Alert.alert(
          "User Muted",
          `You won't see posts from ${userName || "this user"} anymore`,
        );
      } catch (error: any) {
        // Restore posts on error
        setPosts((prev) => [...prev, ...postsToRemove]);
        Alert.alert("Error", error.message || "Failed to mute user");
      }
    },
    [token, posts],
  );

  // ============================================
  // POST ACTIONS - Block User
  // ============================================
  const handleBlockUser = useCallback(
    async (userId: string, userName?: string) => {
      if (!token) return;

      // Remove user's posts from feed
      const postsToRemove = posts.filter((p) => p.user?._id === userId);
      setPosts((prev) => prev.filter((p) => p.user?._id !== userId));

      try {
        await toggleBlockUser(userId);
        Alert.alert(
          "User Blocked",
          `You won't see posts from ${userName || "this user"} anymore`,
        );
      } catch (error: any) {
        // Restore posts on error
        setPosts((prev) => [...prev, ...postsToRemove]);
        Alert.alert("Error", error.message || "Failed to block user");
      }
    },
    [token, posts],
  );

  // ============================================
  // OPTIONS MODAL HANDLERS
  // ============================================
  const handleOptionsModalOpen = useCallback(() => {
    setIsOptionsModalOpen(true);
  }, []);

  const handleOptionsModalClose = useCallback(() => {
    setIsOptionsModalOpen(false);
  }, []);

  // ============================================
  // INITIAL DATA LOADING
  // ============================================
  const loadInitialData = useCallback(async () => {
    if (refreshInProgress.current || initialLoadDone.current) return;
    refreshInProgress.current = true;
    setInitialLoading(true);

    try {
      await loadProfile();
      await Promise.all([fetchPostCount(), fetchConnectionCount()]);
      initialLoadDone.current = true;
    } catch (error) {
      console.error("Error loading initial data:", error);
    } finally {
      if (isMounted.current) {
        setInitialLoading(false);
        refreshInProgress.current = false;
      }
    }
  }, [loadProfile, fetchPostCount, fetchConnectionCount]);

  // ============================================
  // PULL TO REFRESH HANDLER
  // ============================================
  const onRefresh = useCallback(async () => {
    if (refreshing || refreshInProgress.current) return;
    setRefreshing(true);
    setIsCached(false);

    try {
      await profileCache.clear("my_profile");
      if (user?.id) {
        await profileCache.clear(`post_count_${user.id}`);
        await profileCache.clear(`connection_count_${user.id}`);
        await profileCache.clear(`user_posts_${user.id}_page_1`);
      }

      await loadProfile();
      await refreshUserProfile();
      await Promise.all([fetchPostCount(), fetchConnectionCount()]);

      if (activeTab === "posts") {
        await fetchUserPosts(1, false, true);
      }
    } catch (error) {
      console.error("Error refreshing:", error);
    } finally {
      if (isMounted.current) setRefreshing(false);
    }
  }, [
    refreshing,
    user?.id,
    loadProfile,
    refreshUserProfile,
    fetchPostCount,
    fetchConnectionCount,
    activeTab,
    fetchUserPosts,
  ]);

  // ============================================
  // EFFECTS - Initial Load
  // ============================================
  useEffect(() => {
    if (user?.id && !initialLoadDone.current && !authLoading) {
      loadInitialData();
    }
  }, [user?.id, authLoading, loadInitialData]);

  // ============================================
  // EFFECTS - Refresh Counts on Profile Change
  // ============================================
  useEffect(() => {
    if (profile && initialLoadDone.current) {
      fetchPostCount();
      fetchConnectionCount();
    }
  }, [profile, fetchPostCount, fetchConnectionCount]);

  // ============================================
  // EFFECTS - Fetch Posts on Tab Change
  // ============================================
  useEffect(() => {
    if (
      activeTab === "posts" &&
      !postsLoaded &&
      user?.id &&
      !postsLoading &&
      initialLoadDone.current
    ) {
      fetchUserPosts(1, false);
    }
  }, [
    activeTab,
    postsLoaded,
    user?.id,
    postsLoading,
    initialLoadDone.current,
    fetchUserPosts,
  ]);

  // ============================================
  // FOCUS EFFECT - Refresh Data on Screen Focus
  // ============================================
  useFocusEffect(
    useCallback(() => {
      if (user?.id && initialLoadDone.current && !refreshInProgress.current) {
        fetchPostCount();
        fetchConnectionCount();
      }
    }, [
      user?.id,
      fetchPostCount,
      fetchConnectionCount,
      initialLoadDone.current,
    ]),
  );

  // ============================================
  // LOGOUT HANDLERS
  // ============================================
  const handleLogoutConfirm = useCallback(() => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          setShowSettings(false);
          await profileCache.clearAll();
          await logout();
          router.push("/(auth)/login");
        },
      },
    ]);
  }, [logout, router]);

  const handleOpenSettings = useCallback(() => setShowSettings(true), []);
  const handleCloseSettings = useCallback(() => setShowSettings(false), []);

  // ============================================
  // IMAGE PICKER HANDLERS - Profile Picture
  // ============================================
  const handleGalleryPick = useCallback(async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow photo access to upload profile pictures.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      closeUploadModal();
      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadProfileImage(result.assets[0].uri);
        if (success) {
          await profileCache.clear("my_profile");
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select image");
    } finally {
      pickerActiveRef.current = false;
    }
  }, [
    closeUploadModal,
    uploadProfileImage,
    loadProfile,
    refreshUserProfile,
    fetchPostCount,
    fetchConnectionCount,
  ]);

  const handleCameraPick = useCallback(async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Camera Permission",
            "Please allow camera access to take photos.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      closeUploadModal();
      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadProfileImage(result.assets[0].uri);
        if (success) {
          await profileCache.clear("my_profile");
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo");
    } finally {
      pickerActiveRef.current = false;
    }
  }, [
    closeUploadModal,
    uploadProfileImage,
    loadProfile,
    refreshUserProfile,
    fetchPostCount,
    fetchConnectionCount,
  ]);

  const handleDeleteProfileImage = useCallback(async () => {
    const success = await deleteProfileImage();
    if (success) {
      closeUploadModal();
      await profileCache.clear("my_profile");
      await loadProfile();
      await refreshUserProfile();
      await fetchPostCount();
      await fetchConnectionCount();
    }
  }, [
    deleteProfileImage,
    closeUploadModal,
    loadProfile,
    refreshUserProfile,
    fetchPostCount,
    fetchConnectionCount,
  ]);

  const handleImagePress = useCallback(
    () => openUploadModal(),
    [openUploadModal],
  );

  // ============================================
  // IMAGE PICKER HANDLERS - Cover Photo
  // ============================================
  const handleCoverGalleryPick = useCallback(async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Permission Required",
            "Please allow photo access to upload cover photos.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      closeCoverModal();
      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadCoverPhoto(result.assets[0].uri);
        if (success) {
          await profileCache.clear("my_profile");
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to select image");
    } finally {
      pickerActiveRef.current = false;
    }
  }, [
    closeCoverModal,
    uploadCoverPhoto,
    loadProfile,
    refreshUserProfile,
    fetchPostCount,
    fetchConnectionCount,
  ]);

  const handleCoverCameraPick = useCallback(async () => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;

    try {
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== "granted") {
        const { status: newStatus } =
          await ImagePicker.requestCameraPermissionsAsync();
        if (newStatus !== "granted") {
          Alert.alert(
            "Camera Permission",
            "Please allow camera access to take photos.",
          );
          return;
        }
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.8,
      });

      closeCoverModal();
      if (!result.canceled && result.assets?.[0]?.uri) {
        const success = await uploadCoverPhoto(result.assets[0].uri);
        if (success) {
          await profileCache.clear("my_profile");
          await loadProfile();
          await refreshUserProfile();
          await fetchPostCount();
          await fetchConnectionCount();
        }
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo");
    } finally {
      pickerActiveRef.current = false;
    }
  }, [
    closeCoverModal,
    uploadCoverPhoto,
    loadProfile,
    refreshUserProfile,
    fetchPostCount,
    fetchConnectionCount,
  ]);

  const handleDeleteCoverPhoto = useCallback(async () => {
    const success = await deleteCoverPhoto();
    if (success) {
      closeCoverModal();
      await profileCache.clear("my_profile");
      await loadProfile();
      await refreshUserProfile();
      await fetchPostCount();
      await fetchConnectionCount();
    }
  }, [
    deleteCoverPhoto,
    closeCoverModal,
    loadProfile,
    refreshUserProfile,
    fetchPostCount,
    fetchConnectionCount,
  ]);

  const handleCoverPhotoPress = useCallback(
    () => openCoverModal(),
    [openCoverModal],
  );

  // ============================================
  // FORMATTED USER OBJECT
  // ============================================
  const formattedUser = useMemo(
    () => ({
      _id: user?.id,
      name: user?.name || profile?.fullName,
      email: user?.email,
      username: user?.username || profile?.username,
      profileComplete: user?.profileComplete,
    }),
    [user, profile],
  );

  // ============================================
  // MEMOIZED COMPONENT PROPS
  // ============================================
  const profileHeader = useMemo(
    () => (
      <ProfileHeader
        user={formattedUser}
        profile={profile}
        uploading={uploading || pickerActiveRef.current}
        coverUploading={coverUploading}
        onImagePress={handleImagePress}
        onCoverPhotoPress={handleCoverPhotoPress}
      />
    ),
    [
      formattedUser,
      profile,
      uploading,
      pickerActiveRef.current,
      coverUploading,
      handleImagePress,
      handleCoverPhotoPress,
    ],
  );

  const profileTabs = useMemo(
    () => (
      <ProfileTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        postCount={postCount}
      />
    ),
    [activeTab, handleTabChange, postCount],
  );

  const postsProps = useMemo(
    () => ({
      posts,
      loading: postsInitialLoading,
      refreshing: postsRefreshing,
      onRefresh: refreshPosts,
      onLoadMore: loadMorePosts,
      hasMore: hasMorePosts,
      onLikePress: handleLike,
      onCommentPress: handleComment,
      onSharePress: handleShare,
      onEdit: handleEditPost,
      onDelete: handleDeletePost,
      onSave: handleSavePost,
      onReport: handleReportPost,
      onHide: handleHidePost,
      onCopyLink: handleCopyLink,
      onMuteUser: handleMuteUser,
      onBlockUser: handleBlockUser,
      onOptionsOpen: handleOptionsModalOpen,
      onOptionsClose: handleOptionsModalClose,
    }),
    [
      posts,
      postsInitialLoading,
      postsRefreshing,
      refreshPosts,
      loadMorePosts,
      hasMorePosts,
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
      handleOptionsModalOpen,
      handleOptionsModalClose,
    ],
  );

  const aboutContentOnly = useMemo(
    () => (
      <View style={styles.aboutContent}>
        {isCached && (
          <View style={cacheStyles.cacheIndicator}>
            <Ionicons name="cloud-outline" size={12} color={colors.textMuted} />
            <Text style={[cacheStyles.cacheText, { color: colors.textMuted }]}>
              Loaded from cache
            </Text>
          </View>
        )}
        <ProfileInfo profile={profile} user={user} />
        <ProfileStats
          stats={{
            posts: postCount,
            connections: connectionCount,
            communities: profile?.stats?.communities || 0,
          }}
          userId={user?.id || profile?.user?._id}
        />
        <View
          style={[
            menuStyles.menuSection,
            { backgroundColor: colors.card, shadowColor: colors.shadow },
          ]}
        >
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() => router.push("/profile/edit")}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="create-outline" size={22} color={colors.icon} />
              <Text style={[menuStyles.menuText, { color: colors.text }]}>
                Edit Profile
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <View
            style={[menuStyles.divider, { backgroundColor: colors.border }]}
          />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() => router.push("/screens/CommunitiesListScreen" as any)}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="people-outline" size={22} color={colors.icon} />
              <Text style={[menuStyles.menuText, { color: colors.text }]}>
                Communities
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <View
            style={[menuStyles.divider, { backgroundColor: colors.border }]}
          />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={handleOpenSettings}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="settings-outline" size={22} color={colors.icon} />
              <Text style={[menuStyles.menuText, { color: colors.text }]}>
                Settings
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <View
            style={[menuStyles.divider, { backgroundColor: colors.border }]}
          />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={() =>
              Alert.alert("Coming Soon", "Help & Support coming soon!")
            }
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons
                name="help-circle-outline"
                size={22}
                color={colors.icon}
              />
              <Text style={[menuStyles.menuText, { color: colors.text }]}>
                Help & Support
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
          <View
            style={[menuStyles.divider, { backgroundColor: colors.border }]}
          />
          <TouchableOpacity
            style={menuStyles.menuItem}
            onPress={handleLogoutConfirm}
            activeOpacity={0.7}
          >
            <View style={menuStyles.menuItemContent}>
              <Ionicons name="log-out-outline" size={22} color="#ef4444" />
              <Text style={[menuStyles.menuText, { color: "#ef4444" }]}>
                Logout
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      isCached,
      colors,
      profile,
      user,
      postCount,
      connectionCount,
      router,
      handleOpenSettings,
      handleLogoutConfirm,
    ],
  );

  // ============================================
  // SHARE POST DATA
  // ============================================
  const sharePostData = useMemo(() => {
    if (!sharePost) return null;
    return {
      postId: sharePost._id,
      postContent: sharePost.content || "",
      postImage: sharePost.images?.[0]?.url
        ? getFullImageUrl(sharePost.images[0].url)
        : "",
      postAuthorName: sharePost.isAnonymous
        ? "Anonymous"
        : sharePost.community?.name || sharePost.user?.name || "Unknown",
      postAuthorAvatar: sharePost.community?.coverImage
        ? getFullImageUrl(sharePost.community.coverImage)
        : sharePost.user?.profilePicture || "",
      isAnonymous: sharePost.isAnonymous || false,
      postCommunityId: sharePost.community?._id || undefined,
      postCommunityName: sharePost.community?.name || undefined,
      postCommunityCoverImage: sharePost.community?.coverImage
        ? getFullImageUrl(sharePost.community.coverImage)
        : undefined,
    };
  }, [sharePost]);

  // ============================================
  // RENDER - Loading State
  // ============================================
  if ((authLoading || initialLoading) && !profile) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        <OwnProfilePageSkeleton />
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER - No Profile State
  // ============================================
  if (!profile && !authLoading && !initialLoading) {
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
            Complete Your Profile
          </Text>
          <Text
            style={[
              styles.noProfileDescription,
              { color: colors.textSecondary },
            ]}
          >
            Setup your profile to connect with other students
          </Text>
          <TouchableOpacity
            style={[styles.setupButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(auth)/setup-profile")}
          >
            <Ionicons name="person-add-outline" size={20} color="white" />
            <Text style={styles.setupButtonText}>Setup Profile</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER - Main Profile Screen
  // ============================================
  return (
    <>
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
        edges={["top"]}
      >
        {activeTab === "about" ? (
          <ScrollView
            ref={mainScrollViewRef}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={scrollStyles.scrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.primary}
                colors={[colors.primary]}
                progressBackgroundColor={colors.card}
              />
            }
          >
            {profileHeader}
            {profileTabs}
            {aboutContentOnly}
          </ScrollView>
        ) : (
          <>
            {isCached && (
              <View
                style={[
                  cacheStyles.cacheHeader,
                  {
                    backgroundColor: colors.background,
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="cloud-outline"
                  size={12}
                  color={colors.textMuted}
                />
                <Text
                  style={[
                    cacheStyles.cacheHeaderText,
                    { color: colors.textMuted },
                  ]}
                >
                  Loaded from cache
                </Text>
              </View>
            )}
            <MemoizedProfilePosts
              {...postsProps}
              listHeaderComponent={
                <>
                  {profileHeader}
                  {profileTabs}
                  {postsInitialLoading && <OwnPostsLoadingSkeleton />}
                </>
              }
              listFooterComponent={
                loadingMorePosts ? <OwnLoadingMorePostsSkeleton /> : null
              }
            />
          </>
        )}
      </SafeAreaView>

      {/* ============================================ */}
      {/* MODALS - Image Upload */}
      {/* ============================================ */}

      <UploadModal
        visible={uploadModal}
        onClose={closeUploadModal}
        onViewImage={openImageViewer}
        onPickImage={handleGalleryPick}
        onTakePhoto={handleCameraPick}
        onDeletePhoto={handleDeleteProfileImage}
        hasExistingImage={
          !!profile?.profilePicture &&
          !profile.profilePicture.includes("dicebear.com")
        }
        title="Profile Picture"
        viewLabel="View Profile Picture"
        deleteLabel="Remove Profile Picture"
      />

      <UploadModal
        visible={coverModal}
        onClose={closeCoverModal}
        onViewImage={openCoverImageViewer}
        onPickImage={handleCoverGalleryPick}
        onTakePhoto={handleCoverCameraPick}
        onDeletePhoto={handleDeleteCoverPhoto}
        hasExistingImage={!!profile?.coverPhoto}
        title="Cover Photo"
        viewLabel="View Cover Photo"
      />

      <ImageViewModal
        visible={viewPhotoModal}
        imageUri={profile?.profilePicture}
        onClose={closeImageViewer}
        title="Profile Picture"
        isCoverPhoto={false}
      />

      <ImageViewModal
        visible={coverViewModal}
        imageUri={profile?.coverPhoto}
        onClose={closeCoverImageViewer}
        title="Cover Photo"
        isCoverPhoto={true}
      />

      {/* ============================================ */}
      {/* MODALS - Settings */}
      {/* ============================================ */}

      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseSettings}
      >
        <SettingsScreen
          onLogout={() => {
            handleCloseSettings();
            handleLogoutConfirm();
          }}
          userId={user?.id || ""}
          onClose={handleCloseSettings}
        />
      </Modal>

      {/* ============================================ */}
      {/* MODALS - Share Post */}
      {/* ============================================ */}

      {sharePostData && (
        <SharePostModal
          visible={shareModalVisible}
          onClose={() => {
            setShareModalVisible(false);
            setTimeout(() => setSharePost(null), 300);
          }}
          onSuccess={() => {
            Alert.alert("Success", "Post shared successfully");
          }}
          {...sharePostData}
        />
      )}

      {/* ============================================ */}
      {/* MODALS - Report Content */}
      {/* ============================================ */}

      <ReportModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        targetType={reportTargetType}
        targetId={reportTargetId}
        onReportSuccess={handleReportSuccess}
        onShowInfoBar={(message, type) => {
          Alert.alert(type === "success" ? "Success" : "Info", message);
        }}
        reportFunction={(targetId: string, reason: string) =>
          reportContent(reportTargetType, targetId, reason)
        }
      />
    </>
  );
}

// ============================================
// STYLES
// ============================================

const menuStyles = StyleSheet.create({
  menuSection: {
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: "hidden",
    marginTop: 8,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 18,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  menuItemContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  menuText: {
    fontSize: 18,
    color: "#374151",
    fontWeight: "500",
    marginLeft: 12,
    fontFamily: "SofiaSans-Regular",
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginLeft: 52,
  },
});

const scrollStyles = StyleSheet.create({
  scrollContent: {
    paddingBottom: Platform.OS === "ios" ? 90 : 80,
  },
});

const cacheStyles = StyleSheet.create({
  cacheIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
    marginBottom: 8,
  },
  cacheText: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
  cacheHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 4,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cacheHeaderText: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
});
