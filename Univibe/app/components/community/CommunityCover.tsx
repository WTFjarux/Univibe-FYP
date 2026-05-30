// app/components/community/CommunityCover.tsx

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { useAuth } from "../../../lib/contexts/AuthContext";
import { getFullImageUrl } from "../../../lib/services/communityService";
import UploadModal from "../Profile/UploadModal";
import ImageViewModal from "../Profile/ImageViewModal";
import { Community } from "../../../lib/types/community";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface CommunityCoverProps {
  community: Community;
  onCoverUpdate: () => void;
  onCoverView?: () => void;
}

export default function CommunityCover({
  community,
  onCoverUpdate,
  onCoverView,
}: CommunityCoverProps) {
  const { colors } = useTheme();
  const { token } = useAuth();
  const [coverModalVisible, setCoverModalVisible] = useState(false);
  const [coverViewVisible, setCoverViewVisible] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const pickerActiveRef = React.useRef(false);

  const handleCoverPress = () => {
    if (community.isAdmin) {
      setCoverModalVisible(true);
    } else if (community.coverImage) {
      if (onCoverView) {
        onCoverView();
      } else {
        setCoverViewVisible(true);
      }
    }
  };

  const uploadCoverPhoto = async (uri: string) => {
    setCoverUploading(true);
    try {
      const filename = uri.split("/").pop() || "cover.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";
      const formData = new FormData();
      formData.append("coverImage", { uri, name: filename, type } as any);

      const response = await fetch(
        `${require("@/constants/ipConstants").API_BASE_URL}/api/communities/${community._id}`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        },
      );
      const data = await response.json();
      if (data.success) onCoverUpdate();
      else Alert.alert("Error", data.message || "Failed to upload");
    } catch (error) {
      Alert.alert("Error", "Failed to upload cover photo");
    } finally {
      setCoverUploading(false);
    }
  };

  const pickImage = async (type: "gallery" | "camera") => {
    if (pickerActiveRef.current) return;
    pickerActiveRef.current = true;
    try {
      const permission =
        type === "gallery"
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert("Permission Required");
        return;
      }

      const result =
        type === "gallery"
          ? await ImagePicker.launchImageLibraryAsync({
              mediaTypes: "images",
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.8,
            })
          : await ImagePicker.launchCameraAsync({
              mediaTypes: "images",
              allowsEditing: true,
              aspect: [16, 9],
              quality: 0.8,
            });

      setCoverModalVisible(false);
      if (!result.canceled && result.assets?.[0]?.uri) {
        await uploadCoverPhoto(result.assets[0].uri);
      }
    } finally {
      pickerActiveRef.current = false;
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={handleCoverPress}
        activeOpacity={community.isAdmin || community.coverImage ? 0.7 : 1}
      >
        {community.coverImage ? (
          <View>
            <Image
              source={{ uri: getFullImageUrl(community.coverImage) }}
              style={styles.coverImage}
            />
            {community.isAdmin && (
              <View style={styles.coverEditBadge}>
                <Ionicons name="camera" size={14} color="#ffffff" />
                <Text style={styles.coverEditText}>Edit</Text>
              </View>
            )}
          </View>
        ) : (
          <View
            style={[
              styles.coverPlaceholder,
              { backgroundColor: colors.primary + "30" },
            ]}
          >
            <Ionicons name="people" size={48} color={colors.primary} />
            {community.isAdmin && (
              <View style={styles.addCoverButton}>
                <Ionicons
                  name="camera-outline"
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.addCoverText, { color: colors.primary }]}>
                  Add Cover
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      <UploadModal
        visible={coverModalVisible}
        onClose={() => setCoverModalVisible(false)}
        onViewImage={() => {
          setCoverModalVisible(false);
          setCoverViewVisible(true);
        }}
        onPickImage={() => pickImage("gallery")}
        onTakePhoto={() => pickImage("camera")}
        onDeletePhoto={() => {
          setCoverModalVisible(false);
          onCoverUpdate();
        }}
        hasExistingImage={!!community.coverImage}
        title="Cover Photo"
        viewLabel="View Cover Photo"
        deleteLabel="Remove Cover Photo"
      />

      <ImageViewModal
        visible={coverViewVisible}
        imageUri={
          community.coverImage
            ? getFullImageUrl(community.coverImage)
            : undefined
        }
        onClose={() => setCoverViewVisible(false)}
        title="Cover Photo"
        isCoverPhoto={true}
      />
    </>
  );
}

const styles = StyleSheet.create({
  coverImage: { width: SCREEN_WIDTH, height: 160 },
  coverPlaceholder: {
    width: SCREEN_WIDTH,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
  },
  coverEditBadge: {
    position: "absolute",
    bottom: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  coverEditText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "SofiaSans-SemiBold",
  },
  addCoverButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(139, 92, 246, 0.1)",
  },
  addCoverText: { fontSize: 13, fontFamily: "SofiaSans-SemiBold" },
});
