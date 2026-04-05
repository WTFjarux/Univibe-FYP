// app/components/Feed/Post/EditPost.tsx - Fixed version

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
import { useAuth } from "../../../../lib/AuthContext";
import { getPostById, Post } from "../../../../lib/postService";
import { API_BASE_URL } from "../../../../constants/ipConstants";

const { width } = Dimensions.get("window");

export default function EditPostScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { token } = useAuth();

  // State
  const [post, setPost] = useState<Post | null>(null);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState("campus");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<any[]>([]);
  const [imagesToRemove, setImagesToRemove] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Track original values to detect changes
  const [originalContent, setOriginalContent] = useState("");
  const [originalVisibility, setOriginalVisibility] = useState("");
  const [originalIsAnonymous, setOriginalIsAnonymous] = useState(false);
  const [originalImages, setOriginalImages] = useState<any[]>([]);

  // Visibility options - Only campus and connections
  const visibilityOptions = [
    { id: "campus", label: "Campus", icon: "school-outline" },
    { id: "connections", label: "Connections", icon: "people-outline" },
  ];

  // Fetch post data on mount
  useEffect(() => {
    if (postId && token) {
      fetchPost();
    }
  }, [postId, token]);

  /**
   * Fetch post details to edit
   */
  const fetchPost = async () => {
    try {
      const response = await getPostById(postId);
      const postData = response.post;

      setPost(postData);
      setContent(postData.content);
      setVisibility(postData.visibility);
      setIsAnonymous(postData.isAnonymous || false);
      setImages(postData.images || []);

      // Store original values for change detection
      setOriginalContent(postData.content);
      setOriginalVisibility(postData.visibility);
      setOriginalIsAnonymous(postData.isAnonymous || false);
      setOriginalImages(postData.images || []);
    } catch (error: any) {
      console.error("Error fetching post:", error);
      Alert.alert("Error", "Failed to load post");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle anonymous toggle - Force visibility to campus when anonymous is ON
   */
  const handleAnonymousToggle = (value: boolean) => {
    setIsAnonymous(value);

    // If turning ON anonymous, force visibility to "campus"
    if (value) {
      setVisibility("campus");
    }
    // If turning OFF anonymous, keep current visibility (don't change)
  };

  /**
   * Check if any changes have been made to the post
   */
  const hasChanges = () => {
    // Check content change (trim both to ignore whitespace)
    if (content.trim() !== originalContent.trim()) return true;

    // Check visibility change
    if (visibility !== originalVisibility) return true;

    // Check anonymous status change
    if (isAnonymous !== originalIsAnonymous) return true;

    // Check if images were removed
    if (imagesToRemove.length > 0) return true;

    // Check if new images were added
    const originalImageCount = originalImages.length;
    const currentImageCount = images.length;
    if (currentImageCount !== originalImageCount) return true;

    // Check if image order changed or images were replaced
    // Compare image URLs/filenames
    const originalImageKeys = originalImages
      .map((img) => img.filename || img.url || img)
      .sort()
      .join(",");
    const currentImageKeys = images
      .map((img) => img.filename || img.url || img)
      .sort()
      .join(",");
    if (originalImageKeys !== currentImageKeys) return true;

    return false;
  };

  /**
   * Pick images from gallery
   */
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

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        aspect: [4, 3],
        quality: 0.8,
        selectionLimit: 4 - images.length,
      });

      if (!result.canceled && result.assets) {
        const newImages = [
          ...images,
          ...result.assets
            .map((asset) => asset.uri)
            .slice(0, 4 - images.length),
        ];
        setImages(newImages);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick images");
    }
  };

  /**
   * Remove image from post
   */
  const removeImage = (index: number) => {
    const imageToRemove = images[index];

    // If it's an existing image (has filename), mark for removal
    if (imageToRemove.filename) {
      setImagesToRemove((prev) => [...prev, imageToRemove.filename]);
    }

    // Remove from current images array
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async () => {
    if (!content.trim()) {
      Alert.alert("Error", "Post content cannot be empty");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();

      // Append text data
      formData.append("content", content.trim());
      formData.append("visibility", visibility);
      formData.append("isAnonymous", isAnonymous.toString());

      // Append images to remove
      if (imagesToRemove.length > 0) {
        formData.append("removeImages", JSON.stringify(imagesToRemove));
      }

      // Append new images
      const newImages = images.filter((img) => !img.filename);
      for (let i = 0; i < newImages.length; i++) {
        const image = newImages[i];
        const filename = image.split("/").pop() || `image_${i}.jpg`;
        const ext = filename.split(".").pop()?.toLowerCase() || "jpg";

        let mimeType = "image/jpeg";
        if (ext === "png") mimeType = "image/png";
        else if (ext === "gif") mimeType = "image/gif";
        else if (ext === "webp") mimeType = "image/webp";

        const fileObject = {
          uri: image,
          name: `post_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`,
          type: mimeType,
        };
        formData.append("images", fileObject as any);
      }

      // Make API call to update post
      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update post");
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

  const getVisibilityIcon = (option: string) => {
    switch (option) {
      case "campus":
        return "school-outline";
      case "connections":
        return "people-outline";
      default:
        return "globe-outline";
    }
  };

  const getVisibilityLabel = (option: string) => {
    switch (option) {
      case "campus":
        return "Campus";
      case "connections":
        return "Connections";
      default:
        return "Campus";
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            disabled={submitting}
          >
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Post</Text>
          <TouchableOpacity
            style={[
              styles.postButton,
              (!hasChanges() || submitting) && styles.postButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!hasChanges() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Update</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Text Input */}
          <TextInput
            style={styles.input}
            placeholder="What's on your mind?"
            value={content}
            onChangeText={setContent}
            multiline
            maxLength={500}
            editable={!submitting}
            placeholderTextColor="#999"
          />

          {/* Character Count */}
          <Text style={styles.charCount}>{content.length}/500</Text>

          {/* Images Section - Similar to Create Post */}
          {images.length > 0 && (
            <View style={styles.imagesContainer}>
              <Text style={styles.imagesTitle}>Photos ({images.length}/4)</Text>
              <View style={styles.imagesGrid}>
                {images.map((image, index) => (
                  <View key={index} style={styles.imageWrapper}>
                    <Image
                      source={{
                        uri: image.filename
                          ? getFullImageUrl(image.url)
                          : image,
                      }}
                      style={styles.previewImage}
                    />
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() => removeImage(index)}
                      disabled={submitting}
                    >
                      <Ionicons name="close-circle" size={24} color="#fff" />
                    </TouchableOpacity>
                    {images.length > 1 && (
                      <View style={styles.imageNumber}>
                        <Text style={styles.imageNumberText}>{index + 1}</Text>
                      </View>
                    )}
                    {image.filename && (
                      <View style={styles.existingBadge}>
                        <Text style={styles.existingBadgeText}>Existing</Text>
                      </View>
                    )}
                  </View>
                ))}
                {images.length < 4 && (
                  <TouchableOpacity
                    style={styles.addMoreButton}
                    onPress={pickImages}
                    disabled={submitting}
                  >
                    <Ionicons
                      name="add-circle-outline"
                      size={32}
                      color="#8b5cf6"
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Add Image Button - When no images exist (similar to create post) */}
          {images.length === 0 && (
            <TouchableOpacity
              style={styles.addImageButtonSimple}
              onPress={pickImages}
              disabled={submitting}
            >
              <Ionicons name="image-outline" size={24} color="#8b5cf6" />
              <Text style={styles.addImageTextSimple}>Add Photo</Text>
            </TouchableOpacity>
          )}

          {/* Visibility Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Who can see this?
              {isAnonymous && (
                <Text style={styles.anonymousNote}>
                  {" "}
                  (Campus only for anonymous posts)
                </Text>
              )}
            </Text>
            <View style={styles.visibilityOptions}>
              {visibilityOptions.map((option) => {
                // Check if option is disabled (connections is disabled when anonymous)
                const isDisabled = isAnonymous && option.id === "connections";

                return (
                  <TouchableOpacity
                    key={option.id}
                    style={[
                      styles.visibilityOption,
                      visibility === option.id && styles.visibilityOptionActive,
                      isDisabled && styles.visibilityOptionDisabled,
                    ]}
                    onPress={() => {
                      // Don't allow changing to connections if anonymous
                      if (!isDisabled && !submitting) {
                        setVisibility(option.id);
                      }
                    }}
                    disabled={submitting || isDisabled}
                  >
                    <Ionicons
                      name={getVisibilityIcon(option.id)}
                      size={18}
                      color={
                        visibility === option.id
                          ? "#fff"
                          : isDisabled
                            ? "#9ca3af"
                            : "#666"
                      }
                    />
                    <Text
                      style={[
                        styles.visibilityText,
                        visibility === option.id && styles.visibilityTextActive,
                        isDisabled && styles.visibilityTextDisabled,
                      ]}
                    >
                      {getVisibilityLabel(option.id)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.visibilityDescription}>
              {isAnonymous
                ? "Anonymous posts are always visible to everyone in your campus for maximum reach while protecting your identity."
                : visibility === "campus"
                  ? "Visible to all users in your campus"
                  : "Visible to your connections only"}
            </Text>
          </View>

          {/* Anonymous Toggle */}
          <View style={styles.anonymousSection}>
            <TouchableOpacity
              style={styles.anonymousToggle}
              onPress={() => handleAnonymousToggle(!isAnonymous)}
              disabled={submitting}
            >
              <View style={styles.anonymousToggleLeft}>
                <Ionicons
                  name={isAnonymous ? "eye-off" : "eye-off-outline"}
                  size={22}
                  color={isAnonymous ? "#8b5cf6" : "#6b7280"}
                />
                <Text style={styles.anonymousToggleText}>
                  Post as Anonymous
                </Text>
              </View>
              <View
                style={[styles.checkbox, isAnonymous && styles.checkboxActive]}
              >
                {isAnonymous && (
                  <Ionicons name="checkmark" size={16} color="#fff" />
                )}
              </View>
            </TouchableOpacity>

            {isAnonymous && (
              <Text style={styles.anonymousNoteText}>
                Your identity will be hidden. Your name and profile picture
                won't be visible. Anonymous posts are always visible to your
                entire campus.
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Helper to get full image URL
 */
const getFullImageUrl = (url: string): string => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const baseUrl = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;
  const cleanUrl = url.startsWith("/") ? url : `/${url}`;
  return `${baseUrl}${cleanUrl}`;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  postButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 50,
    alignItems: "center",
  },
  postButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  postButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
    fontFamily: "SofiaSans-Bold",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  input: {
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: "top",
    fontFamily: "SofiaSans-Regular",
  },
  charCount: {
    textAlign: "right",
    color: "#999",
    fontSize: 12,
    marginTop: 8,
    marginBottom: 20,
  },
  imagesContainer: {
    marginBottom: 20,
  },
  imagesTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
    fontFamily: "SofiaSans-Bold",
  },
  imagesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  imageWrapper: {
    width: (width - 64) / 2,
    height: (width - 64) / 2,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  removeButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
  },
  imageNumber: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  imageNumberText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  existingBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  existingBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "500",
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
  addImageButtonSimple: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  addImageTextSimple: {
    marginLeft: 8,
    fontSize: 16,
    color: "#000000",
    fontWeight: "500",
    fontFamily: "SofiaSans-Regular",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 16,
    fontFamily: "SofiaSans-Bold",
  },
  anonymousNote: {
    fontSize: 12,
    color: "#6b7280",
    fontStyle: "italic",
  },
  visibilityOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  visibilityOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#eee",
  },
  visibilityOptionActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  visibilityOptionDisabled: {
    backgroundColor: "#e5e7eb",
    borderColor: "#e5e7eb",
    opacity: 0.6,
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#666",
    fontFamily: "SofiaSans-Regular",
  },
  visibilityTextActive: {
    color: "#fff",
  },
  visibilityTextDisabled: {
    color: "#9ca3af",
  },
  visibilityDescription: {
    fontSize: 12,
    color: "#8b5cf6",
    marginTop: 10,
    fontFamily: "SofiaSans-Regular",
  },
  anonymousSection: {
    marginBottom: 20,
  },
  anonymousToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  anonymousToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  anonymousToggleText: {
    fontSize: 16,
    color: "#111827",
    fontFamily: "SofiaSans-Bold",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  anonymousNoteText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    fontStyle: "italic",
    fontFamily: "SofiaSans-Regular",
  },
});
