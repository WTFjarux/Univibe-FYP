// app/components/chat/ChatList/CreateGroupModal.tsx

import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Image,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { API_BASE_URL } from "../../../../constants/ipConstants";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const ACCENT_COLOR = "#8b5cf6";
const MAX_GROUP_NAME_LENGTH = 50;
const MIN_MEMBERS = 2;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface User {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
}

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: (roomId: string, groupName: string) => void;
  token: string | null;
  currentUserId?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function CreateGroupModal({
  visible,
  onClose,
  onGroupCreated,
  token,
  currentUserId,
}: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Reset on open
  useEffect(() => {
    if (visible) {
      resetState();
    }
  }, [visible]);

  // Search users with debounce
  useEffect(() => {
    if (!visible || !searchQuery.trim()) {
      setUsers([]);
      return;
    }
    const timer = setTimeout(() => fetchUsers(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, visible]);

  // Pick image from gallery
  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setGroupPhoto(result.assets[0].uri);
    }
  };

  // Remove selected photo
  const handleRemovePhoto = () => {
    setGroupPhoto(null);
  };

  // Fetch users from connections
  const fetchUsers = async (query: string) => {
    if (!query.trim() || !token) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/profile/search?query=${encodeURIComponent(query)}&limit=20`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();

      if (data.success && data.data) {
        const profiles = Array.isArray(data.data) ? data.data : [];
        const filtered = profiles
          .filter((profile: any) => {
            const userId = profile.user?._id || profile._id;
            return (
              userId !== currentUserId &&
              !selectedUsers.some((u) => u._id === userId)
            );
          })
          .map((profile: any) => ({
            _id: profile.user?._id || profile._id,
            name: profile.user?.name || profile.fullName || "Unknown",
            username: profile.username || "",
            profilePicture: profile.profilePicture || "",
            bio: profile.bio || "",
          }));
        setUsers(filtered);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoading(false);
    }
  };

  // Toggle user selection
  const handleToggleUser = (user: User) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u._id === user._id);
      if (exists) {
        return prev.filter((u) => u._id !== user._id);
      }
      return [...prev, user];
    });
  };

  // Upload group photo
  const uploadGroupPhoto = async (): Promise<string | null> => {
    if (!groupPhoto) return null;

    try {
      const formData = new FormData();
      const filename = groupPhoto.split("/").pop() || "photo.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      formData.append("image", {
        uri: groupPhoto,
        name: filename,
        type,
      } as any);

      const res = await fetch(`${API_BASE_URL}/api/groups/upload-photo`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        body: formData,
      });

      const data = await res.json();


      if (data.success && data.url) {
        return data.url;
      }
      return null;
    } catch (error) {
      console.error("❌ Error uploading photo:", error);
      return null;
    }
  };

  // Create group
  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert("Group Name Required", "Please enter a name for your group.");
      return;
    }
    if (selectedUsers.length < MIN_MEMBERS) {
      Alert.alert(
        "More Members Needed",
        `Please select at least ${MIN_MEMBERS} members.`,
      );
      return;
    }

    setCreating(true);
    try {
      // ✅ Upload photo first if selected
      let photoUrl = null;
      if (groupPhoto) {
        photoUrl = await uploadGroupPhoto();
        if (!photoUrl) {
          Alert.alert(
            "Error",
            "Failed to upload group photo. Creating group without photo.",
          );
        }
      }

      const response = await fetch(`${API_BASE_URL}/api/groups/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDescription.trim(),
          icon: photoUrl, // ✅ Send the uploaded photo URL
          participantIds: selectedUsers.map((u) => u._id),
        }),
      });

      const data = await response.json();
      if (data.success) {
        onGroupCreated(data.data.roomId, groupName.trim());
        handleClose();
      } else {
        Alert.alert("Error", data.message || "Failed to create group");
      }
    } catch (error) {
      Alert.alert("Connection Error", "Please check your internet connection.");
    } finally {
      setCreating(false);
    }
  };

  const resetState = () => {
    setGroupName("");
    setGroupDescription("");
    setGroupPhoto(null);
    setSearchQuery("");
    setUsers([]);
    setSelectedUsers([]);
    setLoading(false);
    setCreating(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const getMemberCountColor = () => {
    const count = selectedUsers.length;
    if (count >= MIN_MEMBERS) return "#34C759";
    if (count > 0) return "#FF9500";
    return "#8E8E93";
  };

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={ACCENT_COLOR} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Group</Text>
          <View style={styles.headerBtn} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.flex}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* ── Group Photo ──────────────────────────── */}
            <View style={styles.photoSection}>
              <TouchableOpacity
                style={styles.photoContainer}
                onPress={handlePickImage}
              >
                {groupPhoto ? (
                  <Image source={{ uri: groupPhoto }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera" size={32} color="#8E8E93" />
                  </View>
                )}
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={12} color="#fff" />
                </View>
              </TouchableOpacity>
              {groupPhoto ? (
                <TouchableOpacity
                  onPress={handleRemovePhoto}
                  style={styles.removePhotoBtn}
                >
                  <Text style={styles.removePhotoText}>Remove Photo</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={styles.addPhotoBtn}
                >
                  <Text style={styles.addPhotoText}>Add Group Photo</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ── Group Name ───────────────────────────── */}
            <View style={styles.inputSection}>
              <Text style={styles.sectionLabel}>GROUP NAME *</Text>
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="chatbox-outline"
                  size={20}
                  color="#8E8E93"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter group name"
                  placeholderTextColor="#C7C7CC"
                  value={groupName}
                  onChangeText={(text) => {
                    if (text.length <= MAX_GROUP_NAME_LENGTH)
                      setGroupName(text);
                  }}
                  maxLength={MAX_GROUP_NAME_LENGTH}
                  autoFocus
                  autoCorrect={false}
                />
              </View>
              <Text style={styles.charCount}>
                {groupName.length}/{MAX_GROUP_NAME_LENGTH}
              </Text>
            </View>

            {/* ── Description ──────────────────────────── */}
            <View style={styles.inputSection}>
              <Text style={styles.sectionLabel}>DESCRIPTION (OPTIONAL)</Text>
              <View style={[styles.inputWrapper, styles.descWrapper]}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color="#8E8E93"
                  style={styles.descIcon}
                />
                <TextInput
                  style={styles.descInput}
                  placeholder="What's this group about?"
                  placeholderTextColor="#C7C7CC"
                  value={groupDescription}
                  onChangeText={setGroupDescription}
                  multiline
                  maxLength={200}
                  textAlignVertical="top"
                />
              </View>
              <Text style={styles.charCount}>
                {groupDescription.length}/200
              </Text>
            </View>

            {/* ── Add Members ──────────────────────────── */}
            <View style={styles.membersSection}>
              <View style={styles.membersHeader}>
                <View style={styles.membersHeaderLeft}>
                  <Ionicons
                    name="people"
                    size={18}
                    color={getMemberCountColor()}
                  />
                  <Text
                    style={[
                      styles.membersCount,
                      { color: getMemberCountColor() },
                    ]}
                  >
                    {selectedUsers.length} member
                    {selectedUsers.length !== 1 ? "s" : ""} selected
                  </Text>
                </View>
                <Text style={styles.minMembers}>Min. {MIN_MEMBERS}</Text>
              </View>

              {/* Selected members chips */}
              {selectedUsers.length > 0 && (
                <View style={styles.chipsScroll}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipsList}
                  >
                    {selectedUsers.map((user) => (
                      <TouchableOpacity
                        key={user._id}
                        style={styles.chip}
                        onPress={() => handleToggleUser(user)}
                      >
                        <View style={styles.chipAvatar}>
                          {user.profilePicture ? (
                            <Image
                              source={{ uri: user.profilePicture }}
                              style={styles.chipAvatarImg}
                            />
                          ) : (
                            <Text style={styles.chipAvatarText}>
                              {user.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <Text style={styles.chipName} numberOfLines={1}>
                          {user.name.split(" ")[0]}
                        </Text>
                        <Ionicons
                          name="close-circle"
                          size={18}
                          color="#8E8E93"
                        />
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* ── Search Users ─────────────────────────── */}
            <View style={styles.searchSection}>
              <View style={styles.searchWrapper}>
                <Ionicons name="search-outline" size={20} color="#8E8E93" />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search connections to add..."
                  placeholderTextColor="#C7C7CC"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={20} color="#8E8E93" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Users List ───────────────────────────── */}
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={ACCENT_COLOR} />
              </View>
            ) : (
              <View>
                {users.length === 0 && searchQuery.trim() ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="person-outline" size={40} color="#C7C7CC" />
                    <Text style={styles.emptyTitle}>No connections found</Text>
                  </View>
                ) : (
                  users.map((item) => {
                    const isSelected = selectedUsers.some(
                      (u) => u._id === item._id,
                    );
                    return (
                      <TouchableOpacity
                        key={item._id}
                        style={[
                          styles.userItem,
                          isSelected && styles.userItemSelected,
                        ]}
                        onPress={() => handleToggleUser(item)}
                      >
                        <View style={styles.userAvatar}>
                          {item.profilePicture ? (
                            <Image
                              source={{ uri: item.profilePicture }}
                              style={styles.userAvatarImg}
                            />
                          ) : (
                            <Text style={styles.userAvatarText}>
                              {item.name.charAt(0).toUpperCase()}
                            </Text>
                          )}
                        </View>
                        <View style={styles.userInfo}>
                          <Text style={styles.userName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          <Text style={styles.userUsername} numberOfLines={1}>
                            @{item.username}
                          </Text>
                        </View>
                        <View
                          style={
                            isSelected
                              ? styles.checkboxSelected
                              : styles.checkboxEmpty
                          }
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>

          {/* ── Create Button ─────────────────────────── */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[
                styles.createBtn,
                (!groupName.trim() ||
                  selectedUsers.length < MIN_MEMBERS ||
                  creating) &&
                  styles.createBtnDisabled,
              ]}
              onPress={handleCreateGroup}
              disabled={
                !groupName.trim() ||
                selectedUsers.length < MIN_MEMBERS ||
                creating
              }
            >
              {creating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.createBtnText}>
                  Create Group
                  {selectedUsers.length >= MIN_MEMBERS
                    ? ` (${selectedUsers.length})`
                    : ""}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 16 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerBtn: { width: 40, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },

  // Photo
  photoSection: { alignItems: "center", paddingTop: 20, paddingBottom: 8 },
  photoContainer: { position: "relative", marginBottom: 12 },
  photo: { width: 90, height: 90, borderRadius: 45 },
  photoPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#EDE9FE",
    borderStyle: "dashed",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: ACCENT_COLOR,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  addPhotoBtn: { paddingVertical: 4 },
  addPhotoText: {
    fontSize: 14,
    color: ACCENT_COLOR,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  removePhotoBtn: { paddingVertical: 4 },
  removePhotoText: {
    fontSize: 14,
    color: "#FF3B30",
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },

  // Inputs
  inputSection: { paddingHorizontal: 20, paddingTop: 16 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#8E8E93",
    marginBottom: 8,
    letterSpacing: 0.5,
    fontFamily: "SofiaSans-SemiBold",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5EA",
    paddingHorizontal: 14,
  },
  descWrapper: { alignItems: "flex-start", paddingVertical: 4 },
  inputIcon: { marginRight: 10 },
  descIcon: { marginRight: 10, marginTop: 10 },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 14,
    color: "#000",
    fontFamily: "SofiaSans-Regular",
  },
  descInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 10,
    minHeight: 60,
    color: "#000",
    fontFamily: "SofiaSans-Regular",
  },
  charCount: {
    fontSize: 12,
    color: "#8E8E93",
    textAlign: "right",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },

  // Members
  membersSection: { paddingHorizontal: 20, paddingTop: 20 },
  membersHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  membersHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  membersCount: {
    fontSize: 14,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  minMembers: {
    fontSize: 12,
    color: "#8E8E93",
    fontFamily: "SofiaSans-Regular",
  },
  chipsScroll: { marginBottom: 4 },
  chipsList: { paddingVertical: 4, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    paddingLeft: 4,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 6,
  },
  chipAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ACCENT_COLOR,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  chipAvatarImg: { width: "100%", height: "100%" },
  chipAvatarText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  chipName: {
    fontSize: 13,
    maxWidth: 80,
    color: "#000",
    fontFamily: "SofiaSans-Medium",
  },

  // Search
  searchSection: { paddingHorizontal: 16, paddingTop: 12 },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#000",
    fontFamily: "SofiaSans-Regular",
  },

  // Users
  loadingContainer: { paddingVertical: 40, alignItems: "center" },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  userItemSelected: { backgroundColor: "rgba(139, 92, 246, 0.06)" },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    overflow: "hidden",
  },
  userAvatarImg: { width: "100%", height: "100%" },
  userAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#8E8E93",
    fontFamily: "SofiaSans-SemiBold",
  },
  userInfo: { flex: 1 },
  userName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    fontFamily: "SofiaSans-Medium",
  },
  userUsername: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
    fontFamily: "SofiaSans-Regular",
  },
  checkboxSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: ACCENT_COLOR,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxEmpty: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C7C7CC",
  },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: {
    fontSize: 14,
    color: "#C7C7CC",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },

  // Bottom
  bottomBar: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  createBtn: {
    backgroundColor: ACCENT_COLOR,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
});
