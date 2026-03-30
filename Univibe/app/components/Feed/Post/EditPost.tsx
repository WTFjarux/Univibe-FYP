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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../../../lib/AuthContext";
import { getPostById, updatePost, Post } from "../../../../lib/postService";
import { API_BASE_URL } from "../../../../constants/stringConstants";

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

  // Visibility options
  const visibilityOptions = [
    { id: "campus", label: "Campus", icon: "school-outline" },
    { id: "connections", label: "Connections", icon: "people-outline" },
    { id: "following", label: "Following", icon: "eye-outline" },
    { id: "private", label: "Only Me", icon: "lock-closed-outline" },
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
    } catch (error: any) {
      console.error("Error fetching post:", error);
      Alert.alert("Error", "Failed to load post");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  /**
   * Pick images from gallery
   */
  const pickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets) {
        // Check total images limit (max 4)
        if (images.length + result.assets.length > 4) {
          Alert.alert("Error", "Maximum 4 images allowed per post");
          return;
        }

        setImages((prev) => [...prev, ...result.assets]);
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
        const fileObject = {
          uri: image.uri,
          name: image.uri.split("/").pop() || `image_${i}.jpg`,
          type: "image/jpeg",
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
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Post</Text>
          <TouchableOpacity
            style={[
              styles.postButton,
              (!content.trim() || submitting) && styles.postButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!content.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Update</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Post Content Input */}
          <View style={styles.inputSection}>
            <TextInput
              style={styles.contentInput}
              placeholder="What's on your mind?"
              placeholderTextColor="#9ca3af"
              value={content}
              onChangeText={setContent}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{content.length}/500</Text>
          </View>

          {/* Images Section */}
          {images.length > 0 && (
            <View style={styles.imagesSection}>
              <Text style={styles.sectionTitle}>Images</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.imagesContainer}>
                  {images.map((image, index) => (
                    <View key={index} style={styles.imageWrapper}>
                      <Image
                        source={{
                          uri: image.filename
                            ? getFullImageUrl(image.url)
                            : image.uri,
                        }}
                        style={styles.image}
                      />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => removeImage(index)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={24}
                          color="#ef4444"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}

                  {/* Add More Images Button */}
                  {images.length < 4 && (
                    <TouchableOpacity
                      style={styles.addImageButton}
                      onPress={pickImages}
                    >
                      <Ionicons
                        name="images-outline"
                        size={24}
                        color="#6b7280"
                      />
                      <Text style={styles.addImageText}>Add More</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Visibility Options */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Who can see this post?</Text>
            <View style={styles.visibilityOptions}>
              {visibilityOptions.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.visibilityOption,
                    visibility === option.id && styles.visibilityOptionActive,
                  ]}
                  onPress={() => setVisibility(option.id)}
                >
                  <Ionicons
                    name={option.icon as any}
                    size={20}
                    color={visibility === option.id ? "#8b5cf6" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.visibilityOptionText,
                      visibility === option.id &&
                        styles.visibilityOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Anonymous Toggle */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.anonymousToggle}
              onPress={() => setIsAnonymous(!isAnonymous)}
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
              <Text style={styles.anonymousNote}>
                Your identity will be hidden. Your name and profile picture
                won't be visible.
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
    borderBottomColor: "#f3f4f6",
    backgroundColor: "#fff",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  postButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#8b5cf6",
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.5,
  },
  postButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  inputSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  contentInput: {
    fontSize: 16,
    color: "#111827",
    minHeight: 120,
    padding: 0,
  },
  charCount: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "right",
    marginTop: 8,
  },
  imagesSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 12,
  },
  imagesContainer: {
    flexDirection: "row",
    gap: 12,
  },
  imageWrapper: {
    position: "relative",
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  addImageText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  visibilityOptions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  visibilityOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    gap: 8,
    minWidth: 120,
  },
  visibilityOptionActive: {
    backgroundColor: "#ede9fe",
    borderWidth: 1,
    borderColor: "#8b5cf6",
  },
  visibilityOptionText: {
    fontSize: 14,
    color: "#6b7280",
  },
  visibilityOptionTextActive: {
    color: "#8b5cf6",
    fontWeight: "500",
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
  anonymousNote: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 8,
    fontStyle: "italic",
  },
});
