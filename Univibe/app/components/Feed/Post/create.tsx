// app/components/Feed/create.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ImageSourcePropType,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { createPost } from "@/lib/services/postService";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTheme } from "@/lib/contexts/ThemeContext";
import { API_BASE_URL } from "@/constants/ipConstants";
import {
  communityService,
  getFullImageUrl,
} from "@/lib/services/communityService";

// ============================================
// CONSTANTS
// ============================================

const DEFAULT_AVATAR: ImageSourcePropType = require("../../../../assets/images/default-avatar.png");
const { width } = Dimensions.get("window");

type Visibility = "campus" | "connections" | "community";

// ============================================
// COMPONENT
// ============================================

export default function CreatePostScreen() {
  const router = useRouter();
  const { communityId } = useLocalSearchParams<{ communityId?: string }>();
  const { profile, user } = useAuth();
  const { colors } = useTheme();

  // ── Form State ──────────────────────────────────
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>("campus");
  const [isAnonymous, setIsAnonymous] = useState(false);

  // ── Community State ─────────────────────────────
  const [community, setCommunity] = useState<any>(null);
  const [loadingCommunity, setLoadingCommunity] = useState(false);
  const isCommunityPost = !!communityId;

  // ============================================
  // FETCH COMMUNITY DATA
  // ============================================

  useEffect(() => {
    if (communityId) {
      const fetchCommunity = async () => {
        setLoadingCommunity(true);
        try {
          const result = await communityService.getCommunity(communityId);
          if (result.success && result.data) {
            const communityData = result.data;
            setCommunity(communityData);

            // ✅ Set initial visibility based on community type
            if (communityData.type === "department") {
              setVisibility("campus");
            } else if (communityData.privacy === "private") {
              setVisibility("community");
            } else {
              setVisibility("campus");
            }
          }
        } catch (error) {
          console.error("Failed to load community:", error);
        } finally {
          setLoadingCommunity(false);
        }
      };
      fetchCommunity();
    }
  }, [communityId]);

  // ============================================
  // ANONYMOUS → FORCE CAMPUS VISIBILITY (normal posts only)
  // ============================================

  useEffect(() => {
    if (isAnonymous && !isCommunityPost) {
      setVisibility("campus");
    }
  }, [isAnonymous, isCommunityPost]);

  // ============================================
  // HELPERS
  // ============================================

  const hasContentToPost = (): boolean => {
    return content.trim().length > 0 || images.length > 0;
  };

  const getLocalImageUrl = (url: string): string => {
    if (!url) return url;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${API_BASE_URL}${url}`;
    return `${API_BASE_URL}/${url}`;
  };

  const getUserAvatar = (): ImageSourcePropType => {
    if (profile?.profilePicture && profile.profilePicture.trim() !== "") {
      return { uri: getLocalImageUrl(profile.profilePicture) };
    }
    return DEFAULT_AVATAR;
  };

  // ============================================
  // IMAGE PICKER
  // ============================================

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please grant photo library permissions to add images",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      aspect: [4, 3],
      quality: 0.8,
      selectionLimit: 4 - images.length,
    });
    if (!result.canceled && result.assets) {
      const newImages = [
        ...images,
        ...result.assets.map((asset) => asset.uri).slice(0, 4 - images.length),
      ];
      setImages(newImages);
    }
  };

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  // ============================================
  // VISIBILITY HELPERS
  // ============================================

  const getVisibilityIcon = (
    option: Visibility,
  ): keyof typeof Ionicons.glyphMap => {
    switch (option) {
      case "campus":
        return "school-outline";
      case "connections":
        return "people-outline";
      case "community":
        return "people";
      default:
        return "globe-outline";
    }
  };

  const getVisibilityLabel = (option: Visibility): string => {
    switch (option) {
      case "campus":
        return "Campus";
      case "connections":
        return "Connections";
      case "community":
        return "Community";
      default:
        return "Public";
    }
  };

  const getVisibilityOptions = (): Visibility[] => {
    if (isAnonymous) return ["campus"];

    // ✅ Community post visibility options
    if (isCommunityPost && community) {
      if (community.privacy === "private" || community.type === "department") {
        // Private community or department - only one option
        return community.privacy === "private" ? ["community"] : ["campus"];
      }
      // Public community - both options
      return ["campus", "community"];
    }

    // Normal post
    return ["campus", "connections"];
  };

  // ============================================
  // DISPLAY INFO
  // ============================================

  const getDisplayName = (): string => {
    if (isCommunityPost && community) return community.name;
    if (isAnonymous) return "Anonymous";
    if (profile?.fullName) return profile.fullName;
    if (user?.name) return user.name;
    return "You";
  };

  const getSubtitle = (): string => {
    if (isCommunityPost) return `Posted by ${user?.name || "Admin"}`;
    if (isAnonymous) return "Hidden identity";
    if (profile?.username) return `@${profile.username}`;
    return "@user";
  };

  // ============================================
  // SUBMIT POST
  // ============================================

  const handleSubmit = async () => {
    if (!hasContentToPost()) {
      Alert.alert("Add content", "Please add some text or photos to post");
      return;
    }
    try {
      setLoading(true);

      const imageObjects =
        images.length > 0
          ? await Promise.all(
              images.map(async (uri) => {
                const filename = uri.split("/").pop() || "";
                const ext = filename.split(".").pop()?.toLowerCase() || "jpg";
                let mimeType = "image/jpeg";
                if (ext === "png") mimeType = "image/png";
                else if (ext === "gif") mimeType = "image/gif";
                else if (ext === "webp") mimeType = "image/webp";
                return {
                  uri,
                  type: mimeType,
                  name: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`,
                };
              }),
            )
          : [];

      const finalVisibility = isAnonymous ? "campus" : visibility;

      await createPost(
        content,
        imageObjects,
        finalVisibility,
        isAnonymous && !isCommunityPost,
        communityId,
      );

      Alert.alert("Posted!", "Your post has been shared.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error("Error creating post:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to create post. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================

  if (loadingCommunity) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: colors.background }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* ── Header ─────────────────────────────── */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} disabled={loading}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isCommunityPost ? "Create Community Post" : "Create Post"}
          </Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !hasContentToPost()}
            style={[
              styles.postButton,
              { backgroundColor: colors.primary },
              (!hasContentToPost() || loading) && styles.postButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Content ────────────────────────────── */}
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* ── User / Community Info Row ────────── */}
          <View style={styles.userInfo}>
            {/* ✅ Community Post → Show community image */}
            {isCommunityPost ? (
              community?.coverImage ? (
                <Image
                  source={{ uri: getFullImageUrl(community.coverImage) }}
                  style={[styles.avatar, { backgroundColor: colors.skeleton }]}
                />
              ) : (
                <View
                  style={[
                    styles.avatar,
                    styles.communityAvatar,
                    { backgroundColor: colors.primary + "30" },
                  ]}
                >
                  <Ionicons name="people" size={20} color={colors.primary} />
                </View>
              )
            ) : isAnonymous ? (
              <View
                style={[
                  styles.avatar,
                  styles.anonymousAvatar,
                  {
                    backgroundColor: colors.skeleton,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name="eye-off"
                  size={20}
                  color={colors.textSecondary}
                />
              </View>
            ) : (
              <Image
                source={getUserAvatar()}
                style={[styles.avatar, { backgroundColor: colors.skeleton }]}
              />
            )}

            {/* Name & Subtitle */}
            <View style={styles.userTextContainer}>
              <Text style={[styles.userName, { color: colors.text }]}>
                {getDisplayName()}
              </Text>
              <Text
                style={[styles.userHandle, { color: colors.textSecondary }]}
              >
                {getSubtitle()}
              </Text>
            </View>

            {/* Anonymous Toggle — Normal posts only, NOT for community posts */}
            {!isCommunityPost && (
              <TouchableOpacity
                style={styles.anonymousToggleRight}
                onPress={() => setIsAnonymous(!isAnonymous)}
                disabled={loading}
              >
                <View
                  style={[
                    styles.toggleContainerRight,
                    { backgroundColor: colors.textMuted },
                  ]}
                >
                  <View
                    style={[
                      styles.toggleCircleRight,
                      isAnonymous && styles.toggleCircleRightActive,
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.toggleTextRight,
                    { color: colors.textSecondary },
                    isAnonymous && [
                      styles.toggleTextRightActive,
                      { color: colors.text },
                    ],
                  ]}
                >
                  {isAnonymous ? "Anonymous ON" : "Post anonymously"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Anonymous warning */}
          {isAnonymous && !isCommunityPost && (
            <View style={styles.anonymousWarning}>
              <Ionicons
                name="information-circle-outline"
                size={16}
                color="#f59e0b"
              />
              <Text style={styles.anonymousWarningText}>
                Your identity will be hidden from other users.
              </Text>
            </View>
          )}

          {/* ── Text Input ───────────────────────── */}
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={
              isCommunityPost
                ? `Share something with ${community?.name || "the community"}...`
                : "What's on your mind?"
            }
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
            editable={!loading}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>
            {content.length}/500
          </Text>

          {/* ── Image Preview ────────────────────── */}
          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              <View style={styles.imagesGrid}>
                {images.map((image, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image
                      source={{ uri: image }}
                      style={styles.previewImage}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#fff" />
                    </TouchableOpacity>
                  </View>
                ))}
                {images.length < 4 && (
                  <TouchableOpacity
                    style={[
                      styles.addMoreButton,
                      { borderColor: colors.border },
                    ]}
                    onPress={pickImage}
                    disabled={loading}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={32}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* ── Visibility Section ───────────────── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Who can see this?
              {isAnonymous && (
                <Text
                  style={[
                    styles.anonymousNote,
                    { color: colors.textSecondary },
                  ]}
                >
                  {" "}
                  (Campus only)
                </Text>
              )}
            </Text>
            <View style={styles.visibilityOptions}>
              {getVisibilityOptions().map((option) => {
                const isActive = visibility === option;
                const isDisabled = loading || (isAnonymous && !isCommunityPost);

                return (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.visibilityOption,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      },
                      isActive && styles.visibilityOptionActive,
                      isDisabled &&
                        !isActive &&
                        styles.visibilityOptionDisabled,
                    ]}
                    onPress={() => !isDisabled && setVisibility(option)}
                    disabled={isDisabled}
                  >
                    <Ionicons
                      name={getVisibilityIcon(option)}
                      size={18}
                      color={isActive ? "#fff" : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.visibilityText,
                        { color: colors.textSecondary },
                        isActive && styles.visibilityTextActive,
                      ]}
                    >
                      {getVisibilityLabel(option)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text
              style={[styles.visibilityDescription, { color: colors.primary }]}
            >
              {isCommunityPost
                ? visibility === "community"
                  ? `Only members of ${community?.name} can see this post.`
                  : "Visible to all users in your campus."
                : isAnonymous
                  ? "Anonymous posts are always visible to everyone in your campus."
                  : visibility === "campus"
                    ? "Visible to all users in your campus"
                    : "Visible to your connections only"}
            </Text>
          </View>

          {/* ── Add Image Button ─────────────────── */}
          {images.length < 4 && images.length === 0 && (
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={pickImage}
              disabled={loading}
            >
              <Ionicons name="image-outline" size={22} color={colors.primary} />
              <Text style={[styles.addImageText, { color: colors.text }]}>
                Add Photo
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },

  // ── Header ────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "SofiaSans-Bold",
    flex: 1,
    textAlign: "center",
  },
  postButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 60,
    alignItems: "center",
  },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },

  // ── Content ───────────────────────────────────
  content: { flex: 1, padding: 16 },

  // ── User Info Row ─────────────────────────────
  userInfo: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0f0f0",
  },
  communityAvatar: { justifyContent: "center", alignItems: "center" },
  anonymousAvatar: {
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
  },
  userTextContainer: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontFamily: "SofiaSans-Bold" },
  userHandle: { fontSize: 13, fontFamily: "SofiaSans-Regular", marginTop: 1 },

  // ── Anonymous Toggle ──────────────────────────
  anonymousToggleRight: { flexDirection: "row", alignItems: "center" },
  toggleContainerRight: {
    width: 36,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  toggleCircleRight: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  toggleCircleRightActive: {
    backgroundColor: "#000",
    transform: [{ translateX: 16 }],
  },
  toggleTextRight: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    marginLeft: 8,
  },
  toggleTextRightActive: { fontWeight: "600" },

  // ── Anonymous Warning ─────────────────────────
  anonymousWarning: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 16,
    gap: 8,
    backgroundColor: "#fef3c7",
    borderRadius: 8,
  },
  anonymousWarningText: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
    color: "#92400e",
    flex: 1,
  },

  // ── Input ─────────────────────────────────────
  input: {
    fontSize: 16,
    minHeight: 120,
    fontFamily: "SofiaSans-Regular",
    textAlignVertical: "top",
  },
  charCount: {
    textAlign: "right",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 16,
    fontFamily: "SofiaSans-Regular",
  },

  // ── Images ────────────────────────────────────
  imagesContainer: { marginBottom: 16 },
  imagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageWrapper: {
    width: (width - 48) / 2,
    height: (width - 48) / 2,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: { width: "100%", height: "100%" },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  addMoreButton: {
    width: (width - 48) / 2,
    height: (width - 48) / 2,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Visibility Section ────────────────────────
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
    marginBottom: 12,
  },
  anonymousNote: {
    fontSize: 13,
    fontStyle: "italic",
    fontFamily: "SofiaSans-Regular",
  },
  visibilityOptions: { flexDirection: "row", gap: 8, marginBottom: 8 },
  visibilityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  visibilityOptionActive: {
    backgroundColor: "#8B5CF6",
    borderColor: "#8B5CF6",
  },
  visibilityOptionDisabled: {
    opacity: 0.5,
  },
  visibilityText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
  visibilityTextActive: { color: "#fff" },
  visibilityDescription: {
    fontSize: 13,
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },

  // ── Add Image Button ──────────────────────────
  addImageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  addImageText: { fontSize: 15, fontFamily: "SofiaSans-SemiBold" },
});
