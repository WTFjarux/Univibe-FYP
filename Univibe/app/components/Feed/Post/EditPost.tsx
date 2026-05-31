// app/components/Feed/Post/EditPost.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../../../lib/contexts/AuthContext";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import {
  getPostById,
  Post,
  getFullImageUrl,
} from "../../../../lib/services/postService";
import {
  communityService,
  getFullImageUrl as getCommunityFullImageUrl,
} from "../../../../lib/services/communityService";
import { API_BASE_URL } from "../../../../constants/ipConstants";
import DiscardChangesModal from "../../DiscardChangesModal";

const { width } = Dimensions.get("window");

type Visibility = "campus" | "connections" | "community";

export default function EditPostScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { token, profile, user } = useAuth();
  const { colors } = useTheme();

  // State
  const [post, setPost] = useState<Post | null>(null);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("campus");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Community state
  const [community, setCommunity] = useState<any>(null);
  const [loadingCommunity, setLoadingCommunity] = useState(false);

  // Track original values
  const [originalContent, setOriginalContent] = useState("");
  const [originalVisibility, setOriginalVisibility] = useState("");
  const [originalIsAnonymous, setOriginalIsAnonymous] = useState(false);
  const [originalImageIds, setOriginalImageIds] = useState<string[]>([]);

  const isCommunityPost = !!post?.community?.name || !!post?.community;

  useEffect(() => {
    if (postId && token) {
      fetchPost();
    }
  }, [postId, token]);

  // Fetch community info if community post
  useEffect(() => {
    if (post && isCommunityPost && post.community?._id) {
      fetchCommunity(post.community._id);
    }
  }, [post, isCommunityPost]);

  const fetchCommunity = async (communityId: string) => {
    setLoadingCommunity(true);
    try {
      const result = await communityService.getCommunity(communityId);
      if (result.success && result.data) {
        setCommunity(result.data);
      }
    } catch (error) {
      console.error("Failed to load community:", error);
    } finally {
      setLoadingCommunity(false);
    }
  };

  const fetchPost = async () => {
    try {
      const response = await getPostById(postId);
      const postData = response.post;

      setPost(postData);
      setContent(postData.content);
      setVisibility(postData.visibility as Visibility);
      setIsAnonymous(postData.isAnonymous || false);

      const processedImages = (postData.images || []).map(
        (img: any, index: number) => ({
          ...img,
          url: getFullImageUrl(img.url),
          isExisting: true,
          id: img._id || img.filename || img.url || `img_${index}`,
          index: index,
        }),
      );

      setImages(processedImages);

      const imageIds = processedImages.map((img) => img.id);
      setOriginalImageIds(imageIds);

      setOriginalContent(postData.content);
      setOriginalVisibility(postData.visibility);
      setOriginalIsAnonymous(postData.isAnonymous || false);
    } catch (error: any) {
      console.error("Error fetching post:", error);
      Alert.alert("Error", "Failed to load post");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleAnonymousToggle = (value: boolean) => {
    setIsAnonymous(value);
    if (value) {
      setVisibility("campus");
    }
  };

  const hasChanges = () => {
    if (content.trim() !== originalContent.trim()) return true;
    if (visibility !== originalVisibility) return true;
    if (isAnonymous !== originalIsAnonymous) return true;

    const currentImageIds = images
      .filter((img) => img.isExisting)
      .map((img) => img.id);
    if (currentImageIds.length !== originalImageIds.length) return true;

    for (let i = 0; i < currentImageIds.length; i++) {
      if (currentImageIds[i] !== originalImageIds[i]) return true;
    }

    if (images.filter((img) => !img.isExisting).length > 0) return true;

    return false;
  };

  const handleBackPress = () => {
    if (hasChanges()) {
      setShowDiscardModal(true);
    } else {
      router.back();
    }
  };

  const handleDiscardChanges = () => {
    setShowDiscardModal(false);
    router.back();
  };

  const pickImages = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Please grant photo library permissions to add images",
        );
        return;
      }

      const remainingSlots = 4 - images.length;
      if (remainingSlots <= 0) {
        Alert.alert(
          "Limit Reached",
          "You can only add up to 4 images per post",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.8,
        selectionLimit: remainingSlots,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map((asset, idx) => ({
          uri: asset.uri,
          isExisting: false,
          id: `new_${Date.now()}_${idx}_${Math.random()}`,
          tempFile: true,
        }));

        setImages((prev) => [...prev, ...newImages]);
      }
    } catch (error) {
      console.error("Error picking images:", error);
      Alert.alert("Error", "Failed to pick images");
    }
  };

  const removeImage = (index: number) => {
    const imageToRemove = images[index];
    if (imageToRemove.isExisting) {
      const imageId =
        imageToRemove._id || imageToRemove.filename || imageToRemove.id;
      if (imageId && !imagesToRemove.includes(imageId)) {
        setImagesToRemove((prev) => [...prev, imageId]);
      }
    }
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert("Error", "Post content cannot be empty");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("content", content.trim());
      formData.append("visibility", visibility);
      formData.append("isAnonymous", isAnonymous.toString());

      if (imagesToRemove.length > 0) {
        imagesToRemove.forEach((imageId) => {
          formData.append("removeImages[]", imageId);
        });
      }

      const newImages = images.filter((img) => !img.isExisting);
      for (let i = 0; i < newImages.length; i++) {
        const image = newImages[i];
        const uri = image.uri;
        const filename = uri.split("/").pop() || `image_${i}.jpg`;
        const ext = filename.split(".").pop()?.toLowerCase() || "jpg";

        let mimeType = "image/jpeg";
        if (ext === "png") mimeType = "image/png";
        else if (ext === "gif") mimeType = "image/gif";
        else if (ext === "webp") mimeType = "image/webp";
        else if (ext === "heic") mimeType = "image/heic";

        const fileObject = {
          uri: uri,
          name: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`,
          type: mimeType,
        };
        formData.append("images", fileObject as any);
      }

      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to update post");
      }

      Alert.alert("Success", "Post updated successfully", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (error: any) {
      console.error("Error updating post:", error);
      Alert.alert("Error", error.message || "Failed to update post");
    } finally {
      setSubmitting(false);
    }
  };

  // Visibility helpers
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
        return "Campus";
    }
  };

  const getVisibilityOptions = (): Visibility[] => {
    if (isCommunityPost && community) {
      if (community.privacy === "private" || community.type === "department") {
        return community.privacy === "private" ? ["community"] : ["campus"];
      }
      return ["campus", "community"];
    }
    if (isAnonymous) return ["campus"];
    return ["campus", "connections"];
  };

  const getDisplayName = (): string => {
    if (isCommunityPost && community) return community.name;
    if (post?.community?.name) return post.community.name;
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

  if (loading || loadingCommunity) {
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

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.backButton}
            disabled={submitting}
          >
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {isCommunityPost ? "Edit Community Post" : "Edit Post"}
          </Text>
          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: colors.primary },
              (!hasChanges() || submitting) && [
                styles.saveButtonDisabled,
                { backgroundColor: colors.textMuted },
              ],
            ]}
            onPress={handleSubmit}
            disabled={!hasChanges() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* User / Community Info Row */}
          <View style={styles.userInfo}>
            {isCommunityPost ? (
              community?.coverImage ? (
                <Image
                  source={{
                    uri: getCommunityFullImageUrl(community.coverImage),
                  }}
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
            ) : null}

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

            {/* Anonymous Toggle - Only for non-community posts */}
            {!isCommunityPost && (
              <TouchableOpacity
                style={styles.anonymousToggleRight}
                onPress={() => handleAnonymousToggle(!isAnonymous)}
                disabled={submitting}
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

          {/* Text Input */}
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="What's on your mind?"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
            editable={!submitting}
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.charCount, { color: colors.textMuted }]}>
            {content.length}/500
          </Text>

          {/* Images */}
          <View style={styles.imagesContainer}>
            <Text style={[styles.imagesTitle, { color: colors.text }]}>
              Photos ({images.length}/4)
            </Text>
            <View style={styles.imagesGrid}>
              {images.map((image, index) => (
                <View key={image.id || index} style={styles.imageWrapper}>
                  <Image
                    source={{ uri: image.isExisting ? image.url : image.uri }}
                    style={styles.previewImage}
                  />
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                    disabled={submitting}
                  >
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 4 && (
                <TouchableOpacity
                  style={[styles.addMoreButton, { borderColor: colors.border }]}
                  onPress={pickImages}
                  disabled={submitting}
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

          {/* Visibility Section */}
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
                const isDisabled =
                  submitting || (isAnonymous && !isCommunityPost);
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
                  ? `Only members of ${community?.name || "the community"} can see this post.`
                  : "Visible to all users in your campus."
                : isAnonymous
                  ? "Anonymous posts are always visible to everyone in your campus."
                  : visibility === "campus"
                    ? "Visible to all users in your campus"
                    : "Visible to your connections only"}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <DiscardChangesModal
        visible={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onDiscard={handleDiscardChanges}
        title="Discard Changes?"
        message="You have unsaved changes. Are you sure you want to leave?"
        keepEditingText="Keep Editing"
        discardText="Discard"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  keyboardView: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  saveButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 50,
    alignItems: "center",
  },
  saveButtonDisabled: { backgroundColor: "#d1d5db" },
  saveButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  content: { flex: 1, padding: 16 },
  // User Info Row
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
  // Anonymous Toggle
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
  // Anonymous Warning
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
  input: {
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    fontFamily: "SofiaSans-Regular",
  },
  charCount: {
    textAlign: "right",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  imagesContainer: { marginBottom: 20 },
  imagesTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
    fontFamily: "SofiaSans-Bold",
  },
  imagesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  imageWrapper: {
    width: (width - 64) / 2,
    height: (width - 64) / 2,
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
    width: (width - 64) / 2,
    height: (width - 64) / 2,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  // Visibility
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    fontFamily: "SofiaSans-Bold",
  },
  anonymousNote: { fontSize: 12, fontStyle: "italic" },
  visibilityOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
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
  visibilityOptionDisabled: { opacity: 0.5 },
  visibilityText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
  visibilityTextActive: { color: "#fff" },
  visibilityDescription: {
    fontSize: 13,
    marginTop: 10,
    fontFamily: "SofiaSans-Regular",
  },
});
