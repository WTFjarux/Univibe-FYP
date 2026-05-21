// app/components/chat/ChatMessage/ForwardModal.tsx

import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import chatApi from "../../../../lib/services/chatApi";
import { useAuth } from "../../../../lib/contexts/AuthContext";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import { getFullImageUrl } from "../../../../lib/utils/chatUtils";
import type { ChatRoom } from "../../../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_AVATAR = require("../../../../assets/images/default-avatar.png");

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface MessageData {
  _id: string;
  message: string;
  type: string;
  mediaUrl?: string;
  mediaName?: string;
  senderName?: string;
  duration?: number;
  thumbnailUrl?: string;
  locationData?: {
    latitude: number;
    longitude: number;
    locationName?: string;
  } | null;
}

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
  messageData: MessageData;
  currentRoomId?: string;
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function ForwardModal({
  visible,
  onClose,
  onSuccess,
  messageData,
  currentRoomId,
}: ForwardModalProps) {
  const { token } = useAuth();
  const { colors, isDark } = useTheme();

  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setSelectedChats(new Set());
      setSearchQuery("");
      fetchChats();
    } else {
      setSearchQuery("");
    }
  }, [visible]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await chatApi.getChatRooms();
      if (response.success && response.data) {
        const filteredChats = currentRoomId
          ? response.data.filter(
              (chat: ChatRoom) => chat.roomId !== currentRoomId,
            )
          : response.data;
        setChats(filteredChats || []);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to load chats");
    } finally {
      setLoading(false);
    }
  };

  const toggleChatSelection = (roomId: string) => {
    setSelectedChats((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(roomId)) {
        newSelected.delete(roomId);
      } else {
        if (newSelected.size >= 5) {
          Alert.alert("Limit", "You can forward to maximum 5 chats at once");
          return prev;
        }
        newSelected.add(roomId);
      }
      return newSelected;
    });
  };

  const handleForward = async () => {
    if (selectedChats.size === 0) {
      Alert.alert("Error", "Please select at least one chat");
      return;
    }
    if (!token) {
      Alert.alert("Error", "Authentication required");
      return;
    }
    setForwarding(true);
    try {
      const response = await chatApi.forwardMessage(
        messageData._id,
        Array.from(selectedChats),
      );
      if (response.success) {
        Alert.alert(
          "Success",
          `Message forwarded to ${response.data?.forwardedCount || 0} chat(s)`,
          [
            {
              text: "OK",
              onPress: () => {
                setForwarding(false);
                onSuccess?.(response.data);
                onClose();
              },
            },
          ],
        );
      } else {
        Alert.alert("Error", response.message || "Failed to forward message");
        setForwarding(false);
      }
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to forward message",
      );
      setForwarding(false);
    }
  };

  const handleAvatarError = (roomId: string) => {
    setAvatarErrors((prev) => new Set([...prev, roomId]));
  };

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase().trim();
    return chats.filter((chat) =>
      (chat.name || "").toLowerCase().includes(query),
    );
  }, [chats, searchQuery]);

  const renderChat = ({ item }: { item: ChatRoom }) => {
    const isSelected = selectedChats.has(item.roomId);
    const avatarUri = item.otherUserAvatar || null;
    const avatarSource =
      avatarUri && !avatarErrors.has(item.roomId)
        ? { uri: getFullImageUrl(avatarUri) }
        : DEFAULT_AVATAR;

    return (
      <TouchableOpacity
        style={[
          styles.chatItem,
          { borderBottomColor: colors.border },
          isSelected && {
            backgroundColor: isDark ? "rgba(167, 139, 250, 0.1)" : "#F2F0FF",
          },
        ]}
        onPress={() => toggleChatSelection(item.roomId)}
        activeOpacity={0.7}
      >
        <View style={styles.checkbox}>
          {isSelected ? (
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.primary}
            />
          ) : (
            <View
              style={[
                styles.uncheckedCircle,
                { borderColor: colors.textMuted },
              ]}
            />
          )}
        </View>
        <Image
          source={avatarSource}
          style={[styles.avatar, { backgroundColor: colors.skeleton }]}
          onError={() => handleAvatarError(item.roomId)}
        />
        <View style={styles.chatInfo}>
          <Text
            style={[styles.chatName, { color: colors.text }]}
            numberOfLines={1}
          >
            {item.name || "Unknown"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyComponent = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons
          name={searchQuery ? "search-outline" : "chatbubbles-outline"}
          size={48}
          color={colors.textMuted}
        />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          {searchQuery ? "No chats found" : "No chats available"}
        </Text>
        {searchQuery && (
          <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>
            Try a different search term
          </Text>
        )}
      </View>
    );
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            Forward to
          </Text>
          <TouchableOpacity
            onPress={handleForward}
            disabled={forwarding || selectedChats.size === 0}
            style={styles.headerButton}
          >
            {forwarding ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.sendButton,
                  { color: colors.primary },
                  selectedChats.size === 0 && { color: colors.textMuted },
                ]}
              >
                Send
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View
          style={[styles.searchContainer, { backgroundColor: colors.skeleton }]}
        >
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search chats..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textMuted}
            autoFocus={false}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={filteredChats}
            renderItem={renderChat}
            keyExtractor={(item) => item.roomId}
            contentContainerStyle={[
              styles.chatList,
              filteredChats.length === 0 && styles.emptyListContainer,
            ]}
            ListEmptyComponent={renderEmptyComponent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          />
        )}

        {selectedChats.size > 0 && (
          <View
            style={[
              styles.selectedCount,
              {
                backgroundColor: isDark
                  ? "rgba(167, 139, 250, 0.1)"
                  : "#F2F0FF",
                borderTopColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.selectedCountText, { color: colors.primary }]}>
              {selectedChats.size} chat{selectedChats.size > 1 ? "s" : ""}{" "}
              selected
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerButton: { padding: 4, minWidth: 44, alignItems: "center" },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  sendButton: {
    fontSize: 17,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
  },
  clearButton: { padding: 4 },
  chatList: { flexGrow: 1 },
  emptyListContainer: { flex: 1, justifyContent: "center" },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  checkbox: { marginRight: 12 },
  uncheckedCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2 },
  avatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  chatInfo: { flex: 1, justifyContent: "center" },
  chatName: { fontSize: 16, fontWeight: "500", fontFamily: "SofiaSans-Medium" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: { fontSize: 16, marginTop: 12, fontFamily: "SofiaSans-Regular" },
  emptySubtext: { fontSize: 13, marginTop: 4, fontFamily: "SofiaSans-Regular" },
  selectedCount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 0.5,
  },
  selectedCountText: {
    fontSize: 13,
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
    textAlign: "center",
  },
});
