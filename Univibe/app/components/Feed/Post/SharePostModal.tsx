// app/components/Feed/Post/SharePostModal.tsx

import React, { useState, useEffect, useRef } from "react";
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
  Dimensions,
  Keyboard,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import chatApi from "../../../../lib/services/chatApi";
import { useAuth } from "../../../../lib/contexts/AuthContext";
import { useTheme } from "../../../../lib/contexts/ThemeContext";
import { getFullImageUrl } from "../../../../lib/utils/chatUtils";
import type { ChatRoom } from "../../../../lib/types/chat.types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
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
  // ✅ Community fields
  postCommunityId?: string;
  postCommunityName?: string;
  postCommunityCoverImage?: string;
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
  postCommunityId,
  postCommunityName,
  postCommunityCoverImage,
}: SharePostModalProps) {
  const { token } = useAuth();
  const { colors } = useTheme();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [isMessageFocused, setIsMessageFocused] = useState(false);
  const messageInputRef = useRef<TextInput>(null);
  const searchInputRef = useRef<TextInput>(null);
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const messageSlideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSelectedChats(new Set());
      setMessage("");
      setSearchQuery("");
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
      setIsMessageFocused(false);
      fetchChats();
      messageSlideAnim.setValue(0);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setIsKeyboardVisible(true);
        if (isMessageFocused) {
          Animated.timing(messageSlideAnim, {
            toValue: e.endCoordinates.height,
            duration: 250,
            useNativeDriver: true,
          }).start();
        }
      },
    );
    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        Animated.timing(messageSlideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setKeyboardHeight(0);
          setIsKeyboardVisible(false);
        });
      },
    );
    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, [isMessageFocused]);

  const fetchChats = async () => {
    try {
      setLoading(true);
      const response = await chatApi.getChatRooms();
      if (response.success && response.data) {
        const filteredChats = response.data.filter((chat: ChatRoom) => {
          if (currentRoomId && chat.roomId === currentRoomId) return false;
          if (chat.type === "group") return true;
          if (chat.type === "direct" && chat.lastMessage) return true;
          return false;
        });
        setChats(filteredChats || []);
      }
    } catch (error) {
      console.error("Error fetching chats:", error);
      Alert.alert("Error", "Failed to load chats");
    } finally {
      setLoading(false);
    }
  };

  const filteredChats = React.useMemo(() => {
    if (!searchQuery.trim()) return chats;
    const query = searchQuery.toLowerCase().trim();
    return chats.filter((chat) =>
      (chat.name || "").toLowerCase().includes(query),
    );
  }, [chats, searchQuery]);

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
      // ✅ Pass community fields to the API
      const response = await chatApi.sharePost(
        postId,
        Array.from(selectedChats),
        message,
        postCommunityId,
        postCommunityName,
        postCommunityCoverImage,
      );

      if (response.success) {
        Keyboard.dismiss();
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

  const getAvatarSource = (chat: ChatRoom) => {
    const isGroup = chat.type === "group";
    if (isGroup && chat.groupPhoto) {
      const uri = getFullImageUrl(chat.groupPhoto);
      if (!avatarErrors.has(chat.roomId)) return { uri };
    }
    if (!isGroup && chat.otherUserAvatar) {
      const uri = getFullImageUrl(chat.otherUserAvatar);
      if (!avatarErrors.has(chat.roomId)) return { uri };
    }
    return null;
  };

  const handleMessageFocus = () => {
    setIsMessageFocused(true);
    if (isKeyboardVisible && keyboardHeight > 0) {
      Animated.timing(messageSlideAnim, {
        toValue: keyboardHeight,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleMessageBlur = () => setIsMessageFocused(false);

  const renderChat = ({ item }: { item: ChatRoom }) => {
    const isSelected = selectedChats.has(item.roomId);
    const isGroup = item.type === "group";
    const avatarSource = getAvatarSource(item);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => toggleChatSelection(item.roomId)}
        activeOpacity={0.7}
      >
        {isSelected && (
          <View style={styles.selectedOverlay}>
            <View
              style={[styles.checkmark, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="checkmark" size={14} color="#fff" />
            </View>
          </View>
        )}
        <View
          style={[styles.avatarWrapper, isSelected && styles.avatarSelected]}
        >
          {avatarSource ? (
            <Image
              source={avatarSource}
              style={[styles.avatar, { backgroundColor: colors.skeleton }]}
              onError={() => handleAvatarError(item.roomId)}
            />
          ) : isGroup ? (
            <View style={[styles.avatar, styles.groupAvatar]}>
              <Ionicons name="people" size={28} color={colors.primary} />
            </View>
          ) : (
            <View
              style={[
                styles.avatar,
                styles.defaultAvatar,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.defaultAvatarText}>
                {(item.name || "U").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.chatName, { color: colors.text }]}
          numberOfLines={1}
        >
          {item.name || "Unknown"}
        </Text>
      </TouchableOpacity>
    );
  };

  if (!visible) return null;

  const modalHeight = isKeyboardVisible
    ? SCREEN_HEIGHT - keyboardHeight + 100
    : SCREEN_HEIGHT * 0.7;

  return (
    <Modal
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      transparent
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.container,
            {
              height: modalHeight,
              transform: [{ translateY: slideAnim }],
              backgroundColor: colors.background,
            },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View
              style={[styles.handle, { backgroundColor: colors.textMuted }]}
            />
            <View style={styles.headerRow}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>
                Share Post
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search */}
          <View
            style={[styles.searchContainer, { backgroundColor: colors.card }]}
          >
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search chats..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setIsMessageFocused(false)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={18}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>

          {selectedChats.size > 0 && (
            <View style={styles.selectedCount}>
              <Text
                style={[styles.selectedCountText, { color: colors.primary }]}
              >
                {selectedChats.size} selected
              </Text>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filteredChats}
              renderItem={renderChat}
              keyExtractor={(item) => item.roomId}
              numColumns={4}
              contentContainerStyle={styles.chatGrid}
              columnWrapperStyle={styles.chatRow}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons
                    name={
                      searchQuery ? "search-outline" : "chatbubbles-outline"
                    }
                    size={48}
                    color={colors.textMuted}
                  />
                  <Text
                    style={[styles.emptyText, { color: colors.textSecondary }]}
                  >
                    {searchQuery ? "No chats found" : "No chats available"}
                  </Text>
                </View>
              }
            />
          )}

          {/* Message Input & Send */}
          <Animated.View
            style={[
              styles.bottomSection,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                transform: [
                  { translateY: Animated.multiply(messageSlideAnim, -1) },
                ],
              },
            ]}
          >
            <View
              style={[
                styles.messageInputContainer,
                { backgroundColor: colors.card },
              ]}
            >
              <TextInput
                ref={messageInputRef}
                style={[styles.messageInput, { color: colors.text }]}
                placeholder="Write a message..."
                value={message}
                onChangeText={setMessage}
                placeholderTextColor={colors.textSecondary}
                maxLength={200}
                multiline
                onFocus={handleMessageFocus}
                onBlur={handleMessageBlur}
              />
            </View>
            <TouchableOpacity
              style={[
                styles.sendButton,
                { backgroundColor: colors.primary },
                (selectedChats.size === 0 || sharing) && [
                  styles.sendButtonDisabled,
                  { backgroundColor: colors.textMuted },
                ],
              ]}
              onPress={handleShare}
              disabled={selectedChats.size === 0 || sharing}
              activeOpacity={0.8}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    backgroundColor: "#f1f1f1",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E5E5EA",
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D1D6",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Bold",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    padding: 8,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    paddingHorizontal: 12,
    height: 36,
    backgroundColor: "#F2F2F7",
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Regular",
  },
  selectedCount: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  selectedCountText: {
    fontSize: 13,
    color: "#8B5CF6",
    fontFamily: "SofiaSans-Medium",
  },
  chatGrid: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chatRow: {
    justifyContent: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  chatItem: {
    alignItems: "center",
    width: "22%",
    position: "relative",
  },
  selectedOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    zIndex: 2,
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarWrapper: {
    marginBottom: 6,
  },
  avatarSelected: {
    opacity: 0.8,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F2F2F7",
  },
  groupAvatar: {
    backgroundColor: "#F3E8FF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E9D5FF",
    borderStyle: "dashed",
  },
  defaultAvatar: {
    backgroundColor: "#8B5CF6",
    justifyContent: "center",
    alignItems: "center",
  },
  defaultAvatarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  chatName: {
    fontSize: 11,
    fontWeight: "500",
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Medium",
    textAlign: "center",
    width: "100%",
  },
  bottomSection: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 0.5,
    borderTopColor: "#E5E5EA",
    gap: 8,
    backgroundColor: "#f1f1f1",
  },
  messageInputContainer: {
    flex: 1,
    backgroundColor: "#dbdbdc",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 100,
  },
  messageInput: {
    fontSize: 14,
    color: "#1C1C1E",
    fontFamily: "SofiaSans-Regular",
    paddingVertical: 0,
    maxHeight: 80,
  },
  sendButton: {
    backgroundColor: "#8B5CF6",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 100,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 30,
    width: "100%",
  },
  emptyText: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 8,
    fontFamily: "SofiaSans-Regular",
  },
});
