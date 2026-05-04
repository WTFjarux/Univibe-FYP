// app/screens/GroupInfoScreen.tsx

import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../../lib/contexts/AuthContext";
import chatApi from "../../lib/services/chatApi";
import socketService from "../../lib/services/socketService";
import DiscardChangesModal from "../components/DiscardChangesModal";
import { API_BASE_URL } from "../../constants/ipConstants";

const ACCENT_COLOR = "#8b5cf6";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface GroupMember {
  userId: string;
  name: string;
  username: string;
  avatar?: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
}

interface ConnectionUser {
  _id: string;
  name: string;
  username: string;
  profilePicture?: string;
  selected?: boolean;
}

// -----------------------------------------------------------------------------
// Helper: Build full image URL
// -----------------------------------------------------------------------------

const buildImageUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const base = API_BASE_URL.replace("/api", "");
  if (url.startsWith("/uploads")) return `${base}${url}`;
  return `${base}/uploads/${url}`;
};

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function GroupInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const roomId = params.roomId as string;

  // Core state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Editable fields
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState<string | null>(null);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [originalData, setOriginalData] = useState<{
    name: string;
    description: string;
    photo: string | null;
  } | null>(null);

  // UI state
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ConnectionUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);

  // Members data
  const [participants, setParticipants] = useState<GroupMember[]>([]);
  const [participantCount, setParticipantCount] = useState(0);

  // Derived
  const currentMember = participants.find((p) => p.userId === user?.id);
  const isOwner = currentMember?.role === "owner";
  const isAdmin = currentMember?.role === "admin" || isOwner;

  const hasUnsavedChanges = useCallback(() => {
    if (!originalData) return false;
    const nameChanged = groupName.trim() !== originalData.name.trim();
    const descChanged =
      groupDescription.trim() !== originalData.description.trim();
    const photoChanged = selectedPhotoUri !== null;
    return nameChanged || descChanged || photoChanged;
  }, [originalData, groupName, groupDescription, selectedPhotoUri]);

  // ---------------------------------------------------------------------------
  // Fetch group info
  // ---------------------------------------------------------------------------
  const fetchGroupInfo = useCallback(async () => {
    if (!roomId || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await chatApi.getSingleRoom(roomId);
      if (response?.success && response?.data) {
        const room = response.data;
        const name = room.name || "Group";
        const desc = room.groupDescription || "";
        const photo = room.groupPhoto || room.groupIcon || null;
        setGroupName(name);
        setGroupDescription(desc);
        setGroupPhoto(photo);
        setSelectedPhotoUri(null);
        setOriginalData({ name, description: desc, photo });
        setParticipantCount(
          room.participantCount || (room.participants || []).length,
        );
        setParticipants(
          (room.participants || []).map((p: any) => ({
            userId: p.userId,
            name: p.name || "Unknown",
            username: p.username || "",
            avatar: p.avatar || "",
            role: p.role || "member",
            joinedAt: p.joinedAt || new Date().toISOString(),
          })),
        );
      }
    } catch {
      Alert.alert("Error", "Failed to load group info");
      router.back();
    } finally {
      setLoading(false);
    }
  }, [roomId, token]);

  useEffect(() => {
    fetchGroupInfo();
  }, [fetchGroupInfo]);

  // ---------------------------------------------------------------------------
  // Search connections
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!showAddMembers || !searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      if (!token) return;
      setSearchLoading(true);
      fetch(
        `${API_BASE_URL}/api/profile/search-connections?query=${encodeURIComponent(searchQuery)}&limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      )
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.data) {
            const existingIds = new Set(participants.map((p) => p.userId));
            setSearchResults(
              data.data
                .filter((u: any) => {
                  const uid = u._id || u.userId;
                  return !existingIds.has(uid) && uid !== user?.id;
                })
                .map((u: any) => ({
                  _id: u._id || u.userId,
                  name: u.name || "Unknown",
                  username: u.username || "",
                  profilePicture: u.profilePicture || "",
                  selected: false,
                })),
            );
          }
        })
        .catch(() => {})
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showAddMembers]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------
  const handleBack = () => {
    if (hasUnsavedChanges()) {
      setShowDiscardModal(true);
    } else {
      router.back();
    }
  };

  const handleDiscard = () => {
    setShowDiscardModal(false);
    // Reset to original data
    if (originalData) {
      setGroupName(originalData.name);
      setGroupDescription(originalData.description);
      setGroupPhoto(originalData.photo);
      setSelectedPhotoUri(null);
    }
    setIsEditingInfo(false);
    router.back();
  };

  // ---------------------------------------------------------------------------
  // Photo handling
  // ---------------------------------------------------------------------------
  const handlePickPhoto = async () => {
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
      setSelectedPhotoUri(result.assets[0].uri);
    }
  };

  const handleRemovePhoto = () => setSelectedPhotoUri("__remove__");

  // ---------------------------------------------------------------------------
  // Save all changes AND close modal
  // ---------------------------------------------------------------------------
  const handleSave = async () => {
    if (!hasUnsavedChanges()) {
      setIsEditingInfo(false);
      return;
    }

    const nameChanged = groupName.trim() !== (originalData?.name || "").trim();
    const descChanged =
      groupDescription.trim() !== (originalData?.description || "").trim();
    const photoChanged = selectedPhotoUri !== null;

    setSaving(true);
    try {
      let newPhotoUrl = groupPhoto;

      // Upload new photo
      if (selectedPhotoUri && selectedPhotoUri !== "__remove__") {
        const formData = new FormData();
        const uri = selectedPhotoUri;
        const filename = uri.split("/").pop() || "photo.jpg";
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : "image/jpeg";
        formData.append("image", { uri, name: filename, type } as any);
        const uploadRes = await fetch(
          `${API_BASE_URL}/api/groups/upload-photo`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );
        const uploadData = await uploadRes.json();
        if (uploadData.success && uploadData.url) newPhotoUrl = uploadData.url;
      } else if (selectedPhotoUri === "__remove__") {
        newPhotoUrl = null;
      }

      const updates: any = {};
      if (nameChanged) updates.name = groupName.trim();
      if (descChanged) updates.description = groupDescription.trim();
      if (photoChanged || newPhotoUrl !== groupPhoto) {
        updates.icon = newPhotoUrl || "";
        updates.groupPhoto = newPhotoUrl || "";
      }

      if (Object.keys(updates).length > 0) {
        const response = await chatApi.updateGroupInfo(roomId, updates);
        if (!response.success) {
          Alert.alert("Error", response.message || "Failed to update group");
          return;
        }
      }

      // Update local state
      setGroupPhoto(newPhotoUrl);
      setSelectedPhotoUri(null);
      setOriginalData({
        name: groupName.trim(),
        description: groupDescription.trim(),
        photo: newPhotoUrl,
      });
      setIsEditingInfo(false); // ✅ Close edit mode

      // ✅ Emit socket event
      if (socketService.getConnectionStatus()) {
        socketService.emit("group_updated", {
          roomId,
          name: nameChanged ? groupName.trim() : undefined,
          icon: photoChanged ? newPhotoUrl : undefined,
          groupPhoto: photoChanged ? newPhotoUrl : undefined,
          description: descChanged ? groupDescription.trim() : undefined,
          updatedBy: user?.id,
          timestamp: new Date().toISOString(),
        });
      }

      Alert.alert("Success", "Group updated successfully");
    } catch {
      Alert.alert("Error", "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Add members
  // ---------------------------------------------------------------------------
  const handleAddSelectedMembers = async () => {
    const selected = searchResults.filter((u) => u.selected);
    if (selected.length === 0) return;
    setAddingMembers(true);
    try {
      const response = await chatApi.addGroupMembers(
        roomId,
        selected.map((u) => u._id),
      );
      if (response.success) {
        await fetchGroupInfo();
        setShowAddMembers(false);
        setSearchQuery("");
        setSearchResults([]);
        Alert.alert("Success", `${selected.length} member(s) added`);
      } else {
        Alert.alert("Error", response.message || "Failed to add members");
      }
    } catch {
      Alert.alert("Error", "Failed to add members");
    } finally {
      setAddingMembers(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Role management
  // ---------------------------------------------------------------------------
  const handleMakeAdmin = async (memberId: string) => {
    try {
      const response = await chatApi.makeAdmin(roomId, memberId);
      if (response.success) {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === memberId ? { ...p, role: "admin" as const } : p,
          ),
        );
        if (socketService.getConnectionStatus())
          socketService.makeAdmin(roomId, memberId);
      }
    } catch {
      Alert.alert("Error", "Failed to change role");
    }
  };

  const handleRemoveAdmin = async (memberId: string) => {
    try {
      const response = await chatApi.removeAdmin(roomId, memberId);
      if (response.success) {
        setParticipants((prev) =>
          prev.map((p) =>
            p.userId === memberId ? { ...p, role: "member" as const } : p,
          ),
        );
        if (socketService.getConnectionStatus())
          socketService.removeAdmin(roomId, memberId);
      }
    } catch {
      Alert.alert("Error", "Failed to change role");
    }
  };

  const handleRemoveMember = (member: GroupMember) => {
    Alert.alert("Remove Member", `Remove ${member.name} from the group?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            const response = await chatApi.removeGroupMember(
              roomId,
              member.userId,
            );
            if (response.success) {
              setParticipants((prev) =>
                prev.filter((p) => p.userId !== member.userId),
              );
              setParticipantCount((c) => c - 1);
              if (socketService.getConnectionStatus())
                socketService.removeGroupMember(roomId, member.userId);
            }
          } catch {
            Alert.alert("Error", "Failed to remove member");
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      "Leave Group",
      isOwner
        ? "As the owner, leaving will transfer ownership. Are you sure?"
        : "Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setLeaving(true);
            try {
              const response = await chatApi.leaveGroup(roomId);
              if (response.success) {
                if (socketService.getConnectionStatus())
                  socketService.leaveGroup(roomId);
                router.back();
              } else {
                Alert.alert(
                  "Error",
                  response.message || "Failed to leave group",
                );
              }
            } catch {
              Alert.alert("Error", "Failed to leave group");
            } finally {
              setLeaving(false);
            }
          },
        },
      ],
    );
  };

  // ✅ Navigate to member's profile instead of DM
  const handleMemberPress = (member: GroupMember) => {
    if (member.userId === user?.id) return;
    router.push(`/profile/${member.userId}`);
  };

  // ---------------------------------------------------------------------------
  // Display helpers
  // ---------------------------------------------------------------------------
  const sortedMembers = [...participants].sort((a, b) => {
    const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
    return (order[a.role] ?? 2) - (order[b.role] ?? 2);
  });

  const displayPhotoUri =
    selectedPhotoUri === "__remove__"
      ? null
      : selectedPhotoUri || buildImageUrl(groupPhoto);
  const selectedCount = searchResults.filter((u) => u.selected).length;

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT_COLOR} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || (!hasUnsavedChanges() && !isEditingInfo)}
          style={styles.headerSaveWrap}
        >
          {saving ? (
            <ActivityIndicator size="small" color={ACCENT_COLOR} />
          ) : (
            <Text
              style={[
                styles.headerSaveText,
                !hasUnsavedChanges() &&
                  !isEditingInfo &&
                  styles.headerSaveDisabled,
              ]}
            >
              {isEditingInfo ? "Done" : "Edit"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {hasUnsavedChanges() && (
        <View style={styles.unsavedBar}>
          <Ionicons name="information-circle" size={16} color="#f59e0b" />
          <Text style={styles.unsavedText}>You have unsaved changes</Text>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Group Photo */}
          <View style={styles.profileSection}>
            <TouchableOpacity
              style={styles.photoWrap}
              onPress={isEditingInfo ? handlePickPhoto : undefined}
              disabled={!isEditingInfo}
            >
              {displayPhotoUri ? (
                <Image source={{ uri: displayPhotoUri }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Ionicons name="people" size={40} color={ACCENT_COLOR} />
                </View>
              )}
              {isEditingInfo && (
                <View style={styles.cameraBadge}>
                  <Ionicons name="camera" size={14} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
            {isEditingInfo &&
              selectedPhotoUri &&
              selectedPhotoUri !== "__remove__" && (
                <TouchableOpacity
                  onPress={handleRemovePhoto}
                  style={styles.removePhotoBtn}
                >
                  <Text style={styles.removePhotoText}>Remove new photo</Text>
                </TouchableOpacity>
              )}
            {isEditingInfo && selectedPhotoUri === "__remove__" && (
              <TouchableOpacity
                onPress={() => setSelectedPhotoUri(null)}
                style={styles.undoPhotoBtn}
              >
                <Text style={styles.undoPhotoText}>Keep current photo</Text>
              </TouchableOpacity>
            )}

            {/* Name */}
            <View style={styles.nameRow}>
              {isEditingInfo ? (
                <TextInput
                  style={styles.nameInput}
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={50}
                  autoFocus
                  placeholder="Group name"
                />
              ) : (
                <View style={styles.nameDisplayRow}>
                  <Text style={styles.groupName}>{groupName}</Text>
                  {isAdmin && (
                    <TouchableOpacity
                      onPress={() => setIsEditingInfo(true)}
                      style={styles.editIconBtn}
                    >
                      <Ionicons name="pencil" size={18} color={ACCENT_COLOR} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>

            {/* Description */}
            {isEditingInfo ? (
              <TextInput
                style={styles.descInput}
                value={groupDescription}
                onChangeText={setGroupDescription}
                maxLength={200}
                multiline
                placeholder="Group description"
                textAlignVertical="top"
              />
            ) : (
              <View style={styles.descDisplayRow}>
                <Text
                  style={[
                    styles.descText,
                    !groupDescription && styles.descPlaceholder,
                  ]}
                >
                  {groupDescription || "Add a group description"}
                </Text>
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => setIsEditingInfo(true)}
                    style={styles.editIconBtn}
                  >
                    <Ionicons name="pencil" size={14} color="#8E8E93" />
                  </TouchableOpacity>
                )}
              </View>
            )}

            <Text style={styles.memberCount}>
              {participantCount} member{participantCount !== 1 ? "s" : ""}
            </Text>
          </View>

          {/* Members */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Members ({participantCount})
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setShowAddMembers(true)}
                >
                  <Ionicons name="person-add" size={20} color={ACCENT_COLOR} />
                </TouchableOpacity>
              )}
            </View>
            {sortedMembers.map((member, idx) => {
              const memberAvatarUrl = buildImageUrl(member.avatar);
              return (
                <TouchableOpacity
                  key={member.userId}
                  style={[
                    styles.memberItem,
                    idx === sortedMembers.length - 1 && styles.lastMemberItem,
                  ]}
                  onPress={() => handleMemberPress(member)}
                  disabled={member.userId === user?.id}
                >
                  <View style={styles.mAvatar}>
                    {memberAvatarUrl ? (
                      <Image
                        source={{ uri: memberAvatarUrl }}
                        style={styles.mAvatarImg}
                      />
                    ) : (
                      <View style={styles.mAvatarPlaceholder}>
                        <Text style={styles.mAvatarText}>
                          {member.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.mInfo}>
                    <View style={styles.mNameRow}>
                      <Text style={styles.mName} numberOfLines={1}>
                        {member.name}
                        {member.userId === user?.id ? " (You)" : ""}
                      </Text>
                      {member.role !== "member" && (
                        <View
                          style={[
                            styles.roleBadge,
                            member.role === "owner"
                              ? styles.ownerBadge
                              : styles.adminBadge,
                          ]}
                        >
                          <Text style={styles.roleText}>
                            {member.role === "owner" ? "Owner" : "Admin"}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.mUsername}>@{member.username}</Text>
                  </View>
                  {/* Chevron to indicate tappable */}
                  {member.userId !== user?.id && (
                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color="#C7C7CC"
                    />
                  )}
                  {isOwner &&
                    member.userId !== user?.id &&
                    member.role !== "owner" && (
                      <View style={styles.mActions}>
                        {member.role === "member" ? (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleMakeAdmin(member.userId)}
                          >
                            <Text style={styles.actionBtnText}>Make Admin</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.actionBtn}
                            onPress={() => handleRemoveAdmin(member.userId)}
                          >
                            <Text style={styles.actionBtnText}>
                              Remove Admin
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  {isAdmin &&
                    member.userId !== user?.id &&
                    member.role !== "owner" && (
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => handleRemoveMember(member)}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#FF3B30"
                        />
                      </TouchableOpacity>
                    )}
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={handleLeaveGroup}
            disabled={leaving}
          >
            {leaving ? (
              <ActivityIndicator size="small" color="#FF3B30" />
            ) : (
              <>
                <Ionicons name="exit-outline" size={20} color="#FF3B30" />
                <Text style={styles.leaveBtnText}>Leave Group</Text>
              </>
            )}
          </TouchableOpacity>
          <View style={styles.spacer} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Add Members Modal */}
      <Modal
        visible={showAddMembers}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setShowAddMembers(false);
          setSearchQuery("");
          setSearchResults([]);
        }}
      >
        <SafeAreaView style={styles.modalContainer} edges={["top"]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                setShowAddMembers(false);
                setSearchQuery("");
                setSearchResults([]);
              }}
            >
              <Ionicons name="close" size={24} color={ACCENT_COLOR} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Members</Text>
            <TouchableOpacity
              onPress={handleAddSelectedMembers}
              disabled={addingMembers || selectedCount === 0}
            >
              <Text
                style={[
                  styles.addText,
                  selectedCount > 0 && styles.addTextActive,
                ]}
              >
                {addingMembers
                  ? "Adding..."
                  : selectedCount > 0
                    ? `Add (${selectedCount})`
                    : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={20} color="#8E8E93" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search connections..."
              placeholderTextColor="#C7C7CC"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="none"
            />
          </View>
          {searchLoading ? (
            <ActivityIndicator
              style={styles.searchLoader}
              color={ACCENT_COLOR}
            />
          ) : (
            <ScrollView
              style={styles.searchResultsList}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.length === 0 ? (
                <View style={styles.emptySearch}>
                  <Text style={styles.emptySearchText}>
                    {searchQuery.trim()
                      ? "No connections found"
                      : "Search your connections to add"}
                  </Text>
                </View>
              ) : (
                searchResults.map((item) => {
                  const isSelected = item.selected;
                  return (
                    <TouchableOpacity
                      key={item._id}
                      style={[
                        styles.userItem,
                        isSelected && styles.userItemSelected,
                      ]}
                      onPress={() =>
                        setSearchResults((prev) =>
                          prev.map((u) =>
                            u._id === item._id
                              ? { ...u, selected: !u.selected }
                              : u,
                          ),
                        )
                      }
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
                        <Text style={styles.userName}>{item.name}</Text>
                        <Text style={styles.userUsername}>
                          @{item.username}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxSelected,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>

      <DiscardChangesModal
        visible={showDiscardModal}
        onClose={() => setShowDiscardModal(false)}
        onDiscard={handleDiscard}
      />
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerBtn: { width: 50 },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-SemiBold",
  },
  headerSaveWrap: { width: 60, alignItems: "flex-end" },
  headerSaveText: {
    fontSize: 16,
    color: ACCENT_COLOR,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  headerSaveDisabled: { opacity: 0.4 },
  unsavedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    backgroundColor: "#FEF3C7",
    gap: 6,
  },
  unsavedText: {
    fontSize: 12,
    color: "#92400E",
    fontFamily: "SofiaSans-Medium",
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  profileSection: {
    alignItems: "center",
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    paddingHorizontal: 20,
  },
  photoWrap: { position: "relative", marginBottom: 16 },
  photo: { width: 80, height: 80, borderRadius: 40 },
  photoPlaceholder: {
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#EDE9FE",
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
  removePhotoBtn: { paddingVertical: 4, marginBottom: 8 },
  removePhotoText: {
    fontSize: 13,
    color: "#FF3B30",
    fontFamily: "SofiaSans-Medium",
  },
  undoPhotoBtn: { paddingVertical: 4, marginBottom: 8 },
  undoPhotoText: {
    fontSize: 13,
    color: ACCENT_COLOR,
    fontFamily: "SofiaSans-Medium",
  },
  nameRow: { width: "100%", marginBottom: 8, alignItems: "center" },
  nameDisplayRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupName: {
    fontSize: 20,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  nameInput: {
    fontSize: 18,
    fontWeight: "600",
    color: "#000",
    textAlign: "center",
    borderBottomWidth: 2,
    borderBottomColor: ACCENT_COLOR,
    paddingVertical: 4,
    fontFamily: "SofiaSans-Bold",
    minWidth: 200,
  },
  editIconBtn: { padding: 4 },
  descDisplayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
  },
  descText: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    fontFamily: "SofiaSans-Regular",
  },
  descPlaceholder: { color: "#C7C7CC", fontStyle: "italic" },
  descInput: {
    fontSize: 14,
    color: "#8E8E93",
    textAlign: "center",
    minHeight: 40,
    maxHeight: 80,
    width: "100%",
    fontFamily: "SofiaSans-Regular",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5EA",
    paddingVertical: 4,
  },
  memberCount: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontFamily: "SofiaSans-SemiBold",
  },
  addBtn: { padding: 4 },
  memberItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
  },
  lastMemberItem: { borderBottomWidth: 0 },
  mAvatar: { marginRight: 12 },
  mAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  mAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F5F3FF",
    justifyContent: "center",
    alignItems: "center",
  },
  mAvatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: ACCENT_COLOR,
    fontFamily: "SofiaSans-SemiBold",
  },
  mInfo: { flex: 1 },
  mNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  mName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#000",
    fontFamily: "SofiaSans-Medium",
    flex: 1,
  },
  mUsername: {
    fontSize: 13,
    color: "#8E8E93",
    marginTop: 2,
    fontFamily: "SofiaSans-Regular",
  },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  ownerBadge: { backgroundColor: "#FEF3C7" },
  adminBadge: { backgroundColor: "#EDE9FE" },
  roleText: {
    fontSize: 11,
    fontWeight: "600",
    color: ACCENT_COLOR,
    fontFamily: "SofiaSans-SemiBold",
  },
  mActions: { marginLeft: 8 },
  actionBtn: { paddingHorizontal: 10, paddingVertical: 6 },
  actionBtnText: {
    fontSize: 13,
    color: ACCENT_COLOR,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
  removeBtn: { marginLeft: 8, padding: 4 },
  leaveBtn: {
    marginTop: 32,
    marginHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FF3B30",
  },
  leaveBtnText: {
    fontSize: 16,
    color: "#FF3B30",
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  spacer: { height: 40 },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#000",
    fontFamily: "SofiaSans-Bold",
  },
  addText: { fontSize: 16, color: "#C7C7CC", fontFamily: "SofiaSans-SemiBold" },
  addTextActive: { color: ACCENT_COLOR },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F0F0",
    margin: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
  },
  searchLoader: { marginTop: 40 },
  searchResultsList: { flex: 1 },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  userAvatarText: { fontSize: 18, fontWeight: "600", color: "#8E8E93" },
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C7C7CC",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: ACCENT_COLOR,
    borderColor: ACCENT_COLOR,
  },
  emptySearch: { alignItems: "center", paddingTop: 60 },
  emptySearchText: {
    fontSize: 14,
    color: "#C7C7CC",
    fontFamily: "SofiaSans-Regular",
  },
});
