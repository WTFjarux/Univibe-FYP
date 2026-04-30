// app/components/Feed/Post/SharePostModal.tsx

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
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import chatApi from "../../../../lib/services/chatApi";
import { useAuth } from "../../../../lib/contexts/AuthContext";
import { getFullImageUrl } from "../../../../lib/utils/chatUtils";
import type { ChatRoom } from "../../../../lib/types/chat.types";

const DEFAULT_AVATAR = require("../../../../assets/images/default-avatar.png");

interface SharePostModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (data: any) => void;
  postId: string;
  postContent?: string;
  postImage?: string;
  postAuthorName?: string;
  postAuthorAvatar?: string;
  isAnonymous?: boolean;
  currentRoomId?: string;
}

export default function SharePostModal({
  visible,
  onClose,
  onSuccess,
  postId,
  postContent,
  postImage,
  postAuthorName,
  postAuthorAvatar,
  isAnonymous = false,
  currentRoomId,
}: SharePostModalProps) {
  const { token } = useAuth();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [message, setMessage] = useState("");
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (visible) {
      setSelectedChats(new Set());
      setSearchQuery("");
      setMessage("");
      fetchChats();
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
          Alert.alert("Limit", "You can share to maximum 5 chats at once");
          return prev;
        }
        newSelected.add(roomId);
      }
      return newSelected;
    });
  };

  const handleShare = async () => {
    if (selectedChats.size === 0) {
      Alert.alert("Error", "Please select at least one chat");
      return;
    }

    setSharing(true);
    try {
      const response = await chatApi.sharePost(
        postId,
        Array.from(selectedChats),
        message,
      );

      if (response.success) {
        onSuccess?.(response.data);
        onClose();
      } else {
        Alert.alert("Error", response.message || "Failed to share post");
      }
    } catch (error: any) {
      console.error("Error sharing post:", error);
      Alert.alert("Error", "Failed to share post");
    } finally {
      setSharing(false);
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

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 35 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerButton}>
            <Ionicons name="close" size={28} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Post</Text>
          <TouchableOpacity
            onPress={handleShare}
            disabled={sharing || selectedChats.size === 0}
            style={styles.headerButton}
          >
            {sharing ? (
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
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
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
            contentContainerStyle={styles.chatList}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={48}
                  color="#C7C7CC"
                />
                <Text style={styles.emptyText}>No chats available</Text>
              </View>
            }
          />
        )}

        {/* Message Input */}
        <View style={styles.messageInputContainer}>
          <Image source={DEFAULT_AVATAR} style={styles.messageAvatar} />
          <TextInput
            style={styles.messageInput}
            placeholder="Write a message..."
            value={message}
            onChangeText={setMessage}
            placeholderTextColor="#8E8E93"
            multiline
            maxLength={200}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5EA",
  },
  headerButton: { padding: 4, minWidth: 44, alignItems: "center" },
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
  sendButtonDisabled: { color: "#C7C7CC" },
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
  chatList: { flexGrow: 1, paddingBottom: 8 },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F2F2F7",
  },
  selectedChat: { backgroundColor: "#F2F0FF" },
  checkbox: { marginRight: 12 },
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
  chatInfo: { flex: 1 },
  chatName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Medium",
  },
  messageInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 25,
    paddingHorizontal: 16,
    height: 50,
    backgroundColor: "#F2F2F7",
    borderRadius: 23,
    gap: 8,
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#E5E5EA",
  },
  messageInput: {
    flex: 1,
    fontSize: 15,
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Regular",
    paddingVertical: 0,
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
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
});
