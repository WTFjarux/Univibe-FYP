/**
 * ChatListScreen.tsx
 *
 * Root screen for the chat list.
 */

import React, { useState, useCallback } from "react";
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { useAuth } from "../../lib/contexts/AuthContext";
import { useChatRooms } from "../../hooks/useChatRooms";
import { useChatListSocket } from "../../hooks/useChatListScoket";
import { useChatItemAnimations } from "../../hooks/useChatItemAnimation";

import { ChatListHeader } from "../components/chat/ChatList/ChatListHeader";
import { SearchBar } from "../components/chat/ChatList/SearchBar";
import { EmptyChatList } from "../components/chat/ChatList/EmptyChatList";
import { NewChatModal } from "../components/chat/ChatList/NewChatModal";
import { ChatItem, ChatRoom } from "../components/chat/ChatList/ChatItem";
import ChatListOptionsModal, {
  ItemLayout,
} from "../components/chat/ChatList/ChatListOptionsModal";
// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ChatListScreen() {
  const router = useRouter();
  const { token, user } = useAuth();

  // ── Data & actions ────────────────────────────────────────────────────────
  const {
    filteredRooms,
    loading,
    refreshing,
    searchQuery,
    setSearchQuery,
    fetchChatRooms,
    onRefresh,
    updateChatRoomLastMessage,
    pinChat,
    toggleRead,
    toggleMute,
    deleteChat,
  } = useChatRooms(token);

  // Real-time socket updates
  useChatListSocket(updateChatRoomLastMessage, fetchChatRooms);

  // ── Long-press selection state ────────────────────────────────────────────
  const [selectedRoom, setSelectedRoom] = useState<ChatRoom | null>(null);
  const [selectedItemLayout, setSelectedItemLayout] = useState<ItemLayout>({
    y: 0,
    height: 0,
  });
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  // ── Item animations ───────────────────────────────────────────────────────
  const {
    itemScaleAnim,
    itemTranslateYAnim,
    highlightAnimRef,
    highlightedRoomIdRef,
    animateItemPop,
    resetItemAnimation,
  } = useChatItemAnimations();

  // ── New-chat modal ────────────────────────────────────────────────────────
  const [showNewChatModal, setShowNewChatModal] = useState(false);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleLongPress = useCallback(
    (
      item: ChatRoom,
      layout: { y: number; height: number; pageX: number; pageY: number },
    ) => {
      console.log("Long press layout:", layout); // Debug log
      setSelectedRoom(item);
      setSelectedItemLayout(layout);
      animateItemPop();
      setShowOptionsModal(true);
    },
    [animateItemPop],
  );

  const handleCloseModal = useCallback(() => {
    resetItemAnimation();
    setShowOptionsModal(false);
    setSelectedRoom(null);
  }, [resetItemAnimation]);

  const navigateToChat = useCallback(
    (room: ChatRoom) => {
      if (showOptionsModal) return;
      router.push({
        pathname: "/screens/ChatScreen",
        params: {
          roomId: room.roomId,
          otherUserName: room.name,
          otherUserId: room.otherUserId ?? "",
          otherUserAvatar: room.otherUserAvatar ?? "",
        },
      });
    },
    [showOptionsModal, router],
  );

  const handleStartNewChat = useCallback(
    (userId: string, userName: string, userAvatar?: string) => {
      setShowNewChatModal(false);
      router.push({
        pathname: "/screens/ChatScreen",
        params: {
          roomId: userId,
          otherUserName: userName,
          otherUserId: userId,
          otherUserAvatar: userAvatar ?? "",
        },
      });
    },
    [router],
  );

  useFocusEffect(
    useCallback(() => {
      fetchChatRooms();
    }, [fetchChatRooms]),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <View style={styles.container}>
        <ChatListHeader onNewChat={() => setShowNewChatModal(true)} />
        <SearchBar value={searchQuery} onChangeText={setSearchQuery} />

        <FlatList
          data={filteredRooms}
          keyExtractor={(item) => item.roomId}
          renderItem={({ item }) => (
            <ChatItem
              item={item}
              isSelected={
                selectedRoom?.roomId === item.roomId && showOptionsModal
              }
              highlightAnim={highlightAnimRef.current}
              isHighlighted={highlightedRoomIdRef.current === item.roomId}
              itemScaleAnim={itemScaleAnim}
              itemTranslateYAnim={itemTranslateYAnim}
              onPress={() => navigateToChat(item)}
              onLongPress={handleLongPress}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={<EmptyChatList />}
          contentContainerStyle={
            filteredRooms.length === 0 ? styles.emptyList : undefined
          }
        />
      </View>

      <NewChatModal
        visible={showNewChatModal}
        onClose={() => setShowNewChatModal(false)}
        onStartChat={handleStartNewChat}
        currentUserId={user?.id}
        token={token}
      />

      <ChatListOptionsModal
        visible={showOptionsModal}
        onClose={handleCloseModal}
        item={selectedRoom}
        itemLayout={selectedItemLayout}
        isPinned={selectedRoom?.isPinned ?? false}
        isMuted={selectedRoom?.isMuted ?? false}
        isRead={selectedRoom?.isRead !== false}
        onPin={() => pinChat(selectedRoom)}
        onToggleRead={() => toggleRead(selectedRoom)}
        onMute={() => toggleMute(selectedRoom)}
        onDelete={() => deleteChat(selectedRoom, handleCloseModal)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  emptyList: {
    flex: 1,
  },
});
