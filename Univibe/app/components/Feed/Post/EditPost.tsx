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
import {
  getPostById,
  Post,
  getFullImageUrl,
} from "../../../../lib/services/postService";
import { API_BASE_URL } from "../../../../constants/ipConstants";
import DiscardChangesModal from "../../DiscardChangesModal";

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
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  // Track original values to detect changes
  const [originalContent, setOriginalContent] = useState("");
  const [originalVisibility, setOriginalVisibility] = useState("");
  const [originalIsAnonymous, setOriginalIsAnonymous] = useState(false);
  const [originalImageIds, setOriginalImageIds] = useState<string[]>([]);

  // Visibility options
  const visibilityOptions = [
    { id: "campus", label: "Campus", icon: "school-outline" },
    { id: "connections", label: "Connections", icon: "people-outline" },
  ];

  useEffect(() => {
    if (postId && token) {
      fetchPost();
    }
  }, [postId, token]);

  const fetchPost = async () => {
    try {
      const response = await getPostById(postId);
      const postData = response.post;

      setPost(postData);
      setContent(postData.content);
      setVisibility(postData.visibility);
      setIsAnonymous(postData.isAnonymous || false);

      // Process existing images with full URLs
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

      // Store original image IDs for comparison
      const imageIds = processedImages.map((img) => img.id);
      setOriginalImageIds(imageIds);

      // Store original values
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

    // Check if images were removed
    const currentImageIds = images
      .filter((img) => img.isExisting)
      .map((img) => img.id);
    if (currentImageIds.length !== originalImageIds.length) return true;

    // Check if image order or content changed
    for (let i = 0; i < currentImageIds.length; i++) {
      if (currentImageIds[i] !== originalImageIds[i]) return true;
    }

    // Check if new images were added
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

    // If it's an existing image, mark for removal from server
    if (imageToRemove.isExisting) {
      // Use _id or filename to identify the image to remove
      const imageId =
        imageToRemove._id || imageToRemove.filename || imageToRemove.id;
      if (imageId && !imagesToRemove.includes(imageId)) {
        setImagesToRemove((prev) => [...prev, imageId]);
        console.log("Marked for removal:", imageId);
      }
    }

    // Remove from local state
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

      // Append text data
      formData.append("content", content.trim());
      formData.append("visibility", visibility);
      formData.append("isAnonymous", isAnonymous.toString());

      // Append images to remove - send as array
      if (imagesToRemove.length > 0) {
        // Send each image ID separately or as JSON string
        imagesToRemove.forEach((imageId) => {
          formData.append("removeImages[]", imageId);
        });
        console.log("Removing images:", imagesToRemove);
      }

      // Append new images
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

      console.log("Updating post with:", {
        postId,
        contentLength: content.length,
        imagesToRemove: imagesToRemove.length,
        newImagesCount: newImages.length,
      });

      const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
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
            onPress={handleBackPress}
            style={styles.backButton}
            disabled={submitting}
          >
            <Ionicons name="close" size={28} color="#000" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Post</Text>
          <TouchableOpacity
            style={[
              styles.saveButton,
              (!hasChanges() || submitting) && styles.saveButtonDisabled,
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

          {/* Images Section */}
          <View style={styles.imagesContainer}>
            <Text style={styles.imagesTitle}>Photos ({images.length}/4)</Text>
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
                  {images.length > 1 && (
                    <View style={styles.imageNumber}>
                      <Text style={styles.imageNumberText}>{index + 1}</Text>
                    </View>
                  )}
                  {image.isExisting && (
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

      {/* Discard Changes Modal */}
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
  saveButton: {
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 50,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#d1d5db",
  },
  saveButtonText: {
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
