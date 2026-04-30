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

  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [forwarding, setForwarding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedChats(new Set());
      setSearchQuery("");
      fetchChats();
    } else {
      // Clean up when modal closes
      setSearchQuery("");
    }
  }, [visible]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await chatApi.getChatRooms();
      if (response.success && response.data) {
        // Filter out the current chat if roomId is available
        const filteredChats = currentRoomId
          ? response.data.filter(
              (chat: ChatRoom) => chat.roomId !== currentRoomId,
            )
          : response.data;
        setChats(filteredChats || []);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
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
          return prev; // Return unchanged if limit reached
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
        const result = response.data;
        Alert.alert(
          "Success",
          `Message forwarded to ${result?.forwardedCount || 0} chat(s)`,
          [
            {
              text: "OK",
              onPress: () => {
                setForwarding(false);
                onSuccess?.(result);
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
      console.error("Error forwarding message:", error);
      const message =
        error.response?.data?.message || "Failed to forward message";
      Alert.alert("Error", message);
      setForwarding(false);
    }
  };

  const handleAvatarError = (roomId: string) => {
    setAvatarErrors((prev) => new Set([...prev, roomId]));
  };

  // Memoized filtered chats with case-insensitive search
  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) {
      return chats;
    }

    const query = searchQuery.toLowerCase().trim();
    return chats.filter((chat) => {
      const name = (chat.name || "").toLowerCase();
      return name.includes(query);
    });
  }, [chats, searchQuery]);

  const renderChat = ({ item }: { item: ChatRoom }) => {
    const isSelected = selectedChats.has(item.roomId);

    // Handle null/undefined avatar with a fallback
    const avatarUri = item.otherUserAvatar || null;
    const avatarSource =
      avatarUri && !avatarErrors.has(item.roomId)
        ? { uri: getFullImageUrl(avatarUri) }
        : DEFAULT_AVATAR;

    return (
      <TouchableOpacity
        style={[styles.chatItem, isSelected && styles.selectedChat]}
        onPress={() => toggleChatSelection(item.roomId)}
        activeOpacity={0.7}
      >
        <View style={styles.checkbox}>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={24} color="#8B5CF6" />
          ) : (
            <View style={styles.uncheckedCircle} />
          )}
        </View>

        <Image
          source={avatarSource}
          style={styles.avatar}
          onError={() => handleAvatarError(item.roomId)}
        />

        <View style={styles.chatInfo}>
          <Text style={styles.chatName} numberOfLines={1}>
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
          color="#C7C7CC"
        />
        <Text style={styles.emptyText}>
          {searchQuery ? "No chats found" : "No chats available"}
        </Text>
        {searchQuery && (
          <Text style={styles.emptySubtext}>Try a different search term</Text>
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
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Forward to</Text>
          <TouchableOpacity
            onPress={handleForward}
            disabled={forwarding || selectedChats.size === 0}
            style={styles.headerButton}
          >
            {forwarding ? (
              <ActivityIndicator size="small" color="#8B5CF6" />
            ) : (
              <Text
                style={[
                  styles.sendButton,
                  selectedChats.size === 0 && styles.sendButtonDisabled,
                ]}
              >
                Send
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#8E8E93" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#8E8E93"
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
              <Ionicons name="close-circle" size={18} color="#8E8E93" />
            </TouchableOpacity>
          )}
        </View>

        {/* Chat List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B5CF6" />
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

        {/* Selected count */}
        {selectedChats.size > 0 && (
          <View style={styles.selectedCount}>
            <Text style={styles.selectedCountText}>
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
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5EA",
  },
  headerButton: {
    padding: 4,
    minWidth: 44,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Bold",
  },
  sendButton: {
    fontSize: 17,
    fontWeight: "600",
    color: "#8B5CF6",
    fontFamily: "SofiaSans-SemiBold",
  },
  sendButtonDisabled: {
    color: "#C7C7CC",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    height: 40,
    backgroundColor: "#F2F2F7",
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Regular",
  },
  clearButton: {
    padding: 4,
  },
  chatList: {
    flexGrow: 1,
  },
  emptyListContainer: {
    flex: 1,
    justifyContent: "center",
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F2F2F7",
  },
  selectedChat: {
    backgroundColor: "#F2F0FF",
  },
  checkbox: {
    marginRight: 12,
  },
  uncheckedCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#C7C7CC",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: "#F2F2F7",
  },
  chatInfo: {
    flex: 1,
    justifyContent: "center",
  },
  chatName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Medium",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#8E8E93",
    marginTop: 12,
    fontFamily: "SofiaSans-Regular",
  },
  emptySubtext: {
    fontSize: 13,
    color: "#C7C7CC",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  selectedCount: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F2F0FF",
    borderTopWidth: 0.5,
    borderTopColor: "#E5E5EA",
  },
  selectedCountText: {
    fontSize: 13,
    color: "#8B5CF6",
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
    textAlign: "center",
  },
});
