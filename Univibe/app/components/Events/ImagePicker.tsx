// components/ImagePicker.tsx - Fixed with correct API
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";

export interface ImageItem {
  id: string;
  uri: string;
  fileName: string;
  type: string;
  isCover: boolean;
}

interface ImagePickerComponentProps {
  images: ImageItem[];
  onImagesChange: (images: ImageItem[]) => void;
  maxImages?: number;
  title?: string;
  subtitle?: string;
  showCover?: boolean;
  isEditMode?: boolean;
  existingImages?: string[];
  existingCoverImage?: string;
  onRemoveExistingImage?: (imageUrl: string) => void;
  onReplaceCoverImage?: (newCoverUri: string) => void;
}

export const ImagePickerComponent = ({
  images,
  onImagesChange,
  maxImages = 5,
  title = "Additional Photos",
  subtitle = "Optional",
  showCover = true,
  isEditMode = false,
  existingImages = [],
  existingCoverImage,
  onRemoveExistingImage,
  onReplaceCoverImage,
}: ImagePickerComponentProps) => {
  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please grant photo library permissions",
      );
      return;
    }

    const remainingSlots = maxImages - images.length;
    if (remainingSlots <= 0) {
      Alert.alert(
        "Limit Reached",
        `You can only upload up to ${maxImages} images per event`,
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: remainingSlots,
    });

    if (!result.canceled && result.assets) {
      const newImages: ImageItem[] = result.assets.map((asset, index) => {
        const filename =
          asset.uri.split("/").pop() || `image_${Date.now()}_${index}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";

        return {
          id: `${Date.now()}_${index}_${Math.random()}`,
          uri: asset.uri,
          fileName: filename,
          type: type,
          isCover: false,
        };
      });

      const updated = [...images, ...newImages];
      onImagesChange(updated);
    }
  };

  const pickCoverImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please grant photo library permissions",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets) {
      const asset = result.assets[0];

      if (isEditMode && onReplaceCoverImage) {
        // In edit mode, notify parent to replace cover
        onReplaceCoverImage(asset.uri);
      } else {
        // In create mode, add as cover image
        const filename =
          asset.uri.split("/").pop() || `cover_${Date.now()}.jpg`;
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";

        const newCoverImage: ImageItem = {
          id: `${Date.now()}_cover_${Math.random()}`,
          uri: asset.uri,
          fileName: filename,
          type: type,
          isCover: true,
        };

        // Remove existing cover flag from other images
        const updatedImages = images.map((img) => ({ ...img, isCover: false }));
        onImagesChange([newCoverImage, ...updatedImages]);
      }
      Alert.alert("Success", "Cover image updated!");
    }
  };

  const setCoverImage = (imageId: string) => {
    if (!showCover) return;
    onImagesChange(
      images.map((img) => ({ ...img, isCover: img.id === imageId })),
    );
    Alert.alert("Success", "Cover image updated!");
  };

  const removeImage = (imageId: string) => {
    const imageToRemove = images.find((img) => img.id === imageId);
    Alert.alert("Remove Image", "Remove this image from your event?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          const updated = images.filter((img) => img.id !== imageId);
          if (showCover && imageToRemove?.isCover && updated.length > 0) {
            updated[0].isCover = true;
          }
          onImagesChange(updated);
        },
      },
    ]);
  };

  const renderCoverImage = () => {
    if (!showCover) return null;

    // In edit mode, show existing cover image
    if (isEditMode && existingCoverImage) {
      return (
        <View style={styles.coverContainer}>
          <Text style={styles.coverLabel}>Cover Photo</Text>
          <View style={styles.coverImageWrapper}>
            <Image
              source={{ uri: existingCoverImage }}
              style={styles.coverImage}
            />
            <View style={styles.coverBadge}>
              <Ionicons name="star" size={16} color="#fff" />
              <Text style={styles.coverBadgeText}>Current Cover</Text>
            </View>
            <TouchableOpacity
              style={styles.changeCoverBtn}
              onPress={pickCoverImage}
            >
              <Ionicons name="camera-outline" size={16} color="#fff" />
              <Text style={styles.changeCoverText}>Replace</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // In create mode or no existing cover
    const coverImage = images.find((img) => img.isCover) || images[0];

    return (
      <View style={styles.coverContainer}>
        <Text style={styles.coverLabel}>Cover Photo *</Text>
        <TouchableOpacity style={styles.imagePicker} onPress={pickCoverImage}>
          {coverImage ? (
            <View style={styles.coverImageWrapper}>
              <Image
                source={{ uri: coverImage.uri }}
                style={styles.coverImage}
              />
              <View style={styles.coverBadge}>
                <Ionicons name="star" size={16} color="#fff" />
                <Text style={styles.coverBadgeText}>Cover Photo</Text>
              </View>
              <TouchableOpacity
                style={styles.changeCoverBtn}
                onPress={pickCoverImage}
              >
                <Ionicons name="camera-outline" size={16} color="#fff" />
                <Text style={styles.changeCoverText}>Change</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={40} color="#9ca3af" />
              <Text style={styles.imagePlaceholderText}>Add Cover Image</Text>
              <Text style={styles.imagePlaceholderSubtext}>
                Required - Tap to add
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderExistingImages = () => {
    if (!isEditMode || existingImages.length === 0) return null;

    // Filter out the cover image from existing images
    const otherExistingImages = existingCoverImage
      ? existingImages.filter((img) => img !== existingCoverImage)
      : existingImages;

    if (otherExistingImages.length === 0 && images.length === 0) return null;

    return (
      <View style={styles.existingSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Additional Photos (
            {otherExistingImages.length +
              images.filter((img) => !img.isCover).length}
            /{maxImages - 1})
          </Text>
          <Text style={styles.sectionSubtitle}>Optional</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalScrollContent}>
            {/* Add Photos Button - Now on the left side */}
            {images.length + otherExistingImages.length < maxImages - 1 && (
              <TouchableOpacity style={styles.addMoreCard} onPress={pickImages}>
                <Ionicons name="add" size={32} color="#8b5cf6" />
                <Text style={styles.addMoreText}>Add Photos</Text>
                <Text style={styles.addMoreSubtext}>
                  {maxImages - 1 - (images.length + otherExistingImages.length)}{" "}
                  left
                </Text>
              </TouchableOpacity>
            )}

            {/* Existing Images */}
            {otherExistingImages.map((imageUrl, index) => (
              <View
                key={`existing-${index}`}
                style={styles.existingImageWrapper}
              >
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.existingImage}
                />
                {onRemoveExistingImage && (
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => onRemoveExistingImage(imageUrl)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                )}
                <View style={styles.imageIndex}>
                  <Text style={styles.imageIndexText}>{index + 1}</Text>
                </View>
              </View>
            ))}

            {/* New Images */}
            {images
              .filter((img) => !img.isCover)
              .map((image, index) => (
                <View key={image.id} style={styles.existingImageWrapper}>
                  <Image
                    source={{ uri: image.uri }}
                    style={styles.existingImage}
                  />
                  <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => removeImage(image.id)}
                  >
                    <Ionicons name="close-circle" size={24} color="#ef4444" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.makeCoverBtn}
                    onPress={() => setCoverImage(image.id)}
                  >
                    <Ionicons name="star-outline" size={14} color="#fff" />
                  </TouchableOpacity>
                  <View style={styles.imageIndex}>
                    <Text style={styles.imageIndexText}>
                      {otherExistingImages.length + index + 1}
                    </Text>
                  </View>
                </View>
              ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  // For create mode
  const renderAdditionalImages = () => {
    if (isEditMode) return null; // Handled by renderExistingImages

    const additionalImages = images.filter((img) => !img.isCover);
    const maxAdditional = maxImages - 1;
    const currentAdditional = additionalImages.length;

    if (currentAdditional === 0 && !isEditMode) {
      return (
        <View style={styles.additionalSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Additional Photos ({currentAdditional}/{maxAdditional})
            </Text>
            <Text style={styles.sectionSubtitle}>Optional</Text>
          </View>
          <TouchableOpacity style={styles.addPhotosButton} onPress={pickImages}>
            <Ionicons name="add-circle-outline" size={24} color="#8b5cf6" />
            <Text style={styles.addPhotosText}>Add Photos</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.additionalSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Additional Photos ({currentAdditional}/{maxAdditional})
          </Text>
          <Text style={styles.sectionSubtitle}>Optional</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.additionalGrid}>
            {images.length < maxImages && (
              <TouchableOpacity style={styles.addMoreCard} onPress={pickImages}>
                <Ionicons name="add" size={32} color="#8b5cf6" />
                <Text style={styles.addMoreText}>Add Photos</Text>
                <Text style={styles.addMoreSubtext}>
                  {maxImages - images.length} left
                </Text>
              </TouchableOpacity>
            )}

            {additionalImages.map((image, index) => (
              <View key={image.id} style={styles.additionalImageWrapper}>
                <Image
                  source={{ uri: image.uri }}
                  style={styles.additionalImage}
                />
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => removeImage(image.id)}
                >
                  <Ionicons name="close-circle" size={24} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.makeCoverBtn}
                  onPress={() => setCoverImage(image.id)}
                >
                  <Ionicons name="star-outline" size={14} color="#fff" />
                </TouchableOpacity>
                <View style={styles.imageIndex}>
                  <Text style={styles.imageIndexText}>{index + 1}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <View>
      {renderCoverImage()}
      {renderExistingImages()}
      {renderAdditionalImages()}
    </View>
  );
};

const styles = StyleSheet.create({
  coverContainer: { marginBottom: 24 },
  coverLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
    fontFamily: "SofiaSans-Bold",
  },
  imagePicker: { width: "100%" },
  coverImageWrapper: {
    position: "relative",
    width: "100%",
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
  },
  coverImage: { width: "100%", height: 200 },
  coverBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8b5cf6",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  coverBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  changeCoverBtn: {
    position: "absolute",
    bottom: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  changeCoverText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
  },
  imagePlaceholder: {
    width: "100%",
    height: 200,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
  },
  imagePlaceholderText: {
    marginTop: 8,
    color: "#9ca3af",
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
  },
  imagePlaceholderSubtext: {
    marginTop: 4,
    color: "#ef4444",
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
  },
  existingSection: { marginBottom: 24 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    fontFamily: "SofiaSans-Bold",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
  horizontalScrollContent: {
    flexDirection: "row",
    gap: 12,
  },
  addMoreCard: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  addMoreText: {
    fontSize: 11,
    color: "#8b5cf6",
    marginTop: 4,
    fontFamily: "SofiaSans-Bold",
  },
  addMoreSubtext: {
    fontSize: 9,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
  existingImageWrapper: {
    position: "relative",
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
  },
  existingImage: { width: "100%", height: "100%" },
  removeBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#fff",
    borderRadius: 12,
  },
  makeCoverBtn: {
    position: "absolute",
    bottom: 4,
    left: 4,
    backgroundColor: "rgba(139, 92, 246, 0.8)",
    borderRadius: 12,
    padding: 4,
  },
  imageIndex: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  imageIndexText: { color: "#fff", fontSize: 9, fontFamily: "SofiaSans-Bold" },
  additionalSection: { marginBottom: 24 },
  additionalGrid: { flexDirection: "row", gap: 12 },
  additionalImageWrapper: {
    position: "relative",
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 12,
  },
  additionalImage: { width: "100%", height: "100%" },
  addPhotosButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderStyle: "dashed",
    backgroundColor: "#f9fafb",
  },
  addPhotosText: {
    fontSize: 14,
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Regular",
  },
});

export default ImagePickerComponent;
