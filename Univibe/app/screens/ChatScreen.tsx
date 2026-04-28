// app/screens/ChatScreen.tsx

import React, { useRef, useCallback, useEffect, useMemo } from "react";
import {
  View,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Alert,
  Text,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useChatScreen } from "../../hooks/chatScreen/useChatScreen";
import ChatHeader from "../components/chat/ChatMessage/ChatHeader";
import ChatInput from "../components/chat/ChatMessage/ChatInput";
import ReplyIndicator from "../components/chat/ChatMessage/ReplyIndicator";
import MessageItem from "../components/chat/ChatMessage/MessageItem";
import DateSeparator from "../components/chat/ChatMessage/DateSeparator";
import AudioManager from "../../lib/utils/AudioManager";
import {
  formatMessageTime,
  formatDateSeparator,
  isNewDay,
  getTimeDifferenceInMinutes,
  getFullImageUrl,
  getSenderId,
} from "../../lib/utils/chatUtils";
import { isTempId } from "../../lib/utils/messageIdGenerator";
import type { Message } from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const DEFAULT_AVATAR = require("../../assets/images/default-avatar.png");

/** Maximum time gap between messages before showing a new timestamp */
const MESSAGE_TIME_GAP_MINUTES = 5;

// -----------------------------------------------------------------------------
// Memoized Components
// -----------------------------------------------------------------------------

/**
 * Memoized wrapper around MessageItem to prevent unnecessary re-renders.
 * Only re-renders when critical message properties change.
 */
const MemoizedMessageItem = React.memo(MessageItem, (prev, next) => {
  return (
    prev.item._id === next.item._id &&
    prev.item.status === next.item.status &&
    prev.item.reactions === next.item.reactions &&
    prev.isOwnMessage === next.isOwnMessage &&
    prev.showAvatar === next.showAvatar &&
    prev.showTime === next.showTime &&
    prev.highlightedMessageId === next.highlightedMessageId
  );
});

// -----------------------------------------------------------------------------
// ChatScreen Component
// -----------------------------------------------------------------------------

export default function ChatScreen() {
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);

  // ─── State & Handlers from custom hook ──────────────────────────────────────

  const {
    messages,
    loading,
    refreshing,
    loadingMore,
    hasMore,
    loadMessages,
    loadOlderMessages,
    socketConnected,
    isOnline,
    uploading,
    replyToMessage,
    highlightedMessageId,
    otherUserName,
    otherUserId,
    otherUserAvatar,
    user,
    clearAllPending,
    clearHighlight,
    cleanupScroll,
    audioCleanup,
    onRefresh,
    handleSendMessage,
    handleReply,
    cancelReply,
    handleReaction,
    handleDelete,
    markAudioAsPlayed,
    handleAttachmentsSelected,
    handleLocationShared,
    handleScrollToMessage,
    registerMessageRef,
    isRecording,
    recordingDuration,
    startRecording,
    stopRecording,
    cancelRecording,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
    initialScrollToBottom,
    enableAutoScroll,
  } = useChatScreen(flatListRef);

  // ---------------------------------------------------------------------------
  // Lifecycle Effects
  // ---------------------------------------------------------------------------

  /** Cleanup all resources on unmount */
  useEffect(() => {
    return () => {
      clearAllPending();
      clearHighlight();
      cleanupScroll();
      audioCleanup();
      AudioManager.stopAllSounds();
    };
  }, []);

  /** Fetch latest messages on initial mount, bypassing cache */
  useEffect(() => {
    loadMessages(true);
  }, []);

  /** Fetch latest messages every time the screen gains focus */
  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
    }, [loadMessages]),
  );

  /** Fetch latest messages when socket reconnects to catch missed messages */
  useEffect(() => {
    if (socketConnected) {
      loadMessages(true);
    }
  }, [socketConnected, loadMessages]);

  /** Scroll to bottom once messages finish loading */
  useEffect(() => {
    if (!loading && messages.length > 0) {
      const timer = setTimeout(() => {
        initialScrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, messages.length, initialScrollToBottom]);

  /** Auto-focus the input field when replying to a message */
  useEffect(() => {
    if (replyToMessage) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [replyToMessage]);

  // ---------------------------------------------------------------------------
  // Derived Data
  // ---------------------------------------------------------------------------

  /** Reverse messages for inverted FlatList display (newest at bottom visually) */
  const reversedMessages = useMemo(() => {
    return [...messages].reverse();
  }, [messages]);

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  /** Load older messages when user scrolls to the top (inverted: bottom) */
  const handleEndReached = useCallback(() => {
    if (hasMore && !loadingMore) loadOlderMessages();
  }, [hasMore, loadingMore, loadOlderMessages]);

  /** Determine if a message was sent by the current user */
  const isOwnMessage = useCallback(
    (message: Message): boolean => {
      if (!user?.id) return false;
      if (isTempId(message._id) || message.status === "sending") return true;
      return getSenderId(message).toString() === user.id.toString();
    },
    [user?.id],
  );

  /**
   * Render a single message item within the FlatList.
   * Handles date separators, avatar visibility, and timestamps.
   */
  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const actualIndex = messages.length - 1 - index;
      const ownMessage = isOwnMessage(item);

      const showDateSeparator =
        actualIndex === 0 ||
        isNewDay(item.createdAt, messages[actualIndex - 1]?.createdAt);

      const showAvatar =
        !ownMessage &&
        (actualIndex === 0 ||
          getSenderId(messages[actualIndex - 1]) !== getSenderId(item));

      const showTime =
        actualIndex === messages.length - 1 ||
        getTimeDifferenceInMinutes(
          item.createdAt,
          messages[actualIndex + 1]?.createdAt || item.createdAt,
        ) > MESSAGE_TIME_GAP_MINUTES ||
        (messages[actualIndex + 1] &&
          getSenderId(messages[actualIndex + 1]) !== getSenderId(item));

      return (
        <View>
          {showDateSeparator && (
            <DateSeparator date={formatDateSeparator(item.createdAt)} />
          )}
          <MemoizedMessageItem
            item={item}
            index={actualIndex}
            messages={messages}
            isOwnMessage={ownMessage}
            showAvatar={showAvatar}
            showTime={showTime}
            formatTime={formatMessageTime}
            getFullImageUrl={getFullImageUrl}
            DEFAULT_AVATAR={DEFAULT_AVATAR}
            onAudioPlayed={markAudioAsPlayed}
            onReaction={handleReaction}
            onReply={handleReply}
            onDelete={handleDelete}
            onForward={() =>
              Alert.alert("Forward", "Forward feature coming soon!")
            }
            currentUserId={user?.id}
            highlightedMessageId={highlightedMessageId || undefined}
            onScrollToMessage={handleScrollToMessage}
            registerMessageRef={registerMessageRef}
          />
        </View>
      );
    },
    [
      messages,
      user?.id,
      isOwnMessage,
      markAudioAsPlayed,
      handleReaction,
      handleReply,
      handleDelete,
      highlightedMessageId,
      handleScrollToMessage,
      registerMessageRef,
    ],
  );

  /** Extract a unique key for each message in the FlatList */
  const keyExtractor = useCallback((item: Message, index: number) => {
    if (item._id && !isTempId(item._id)) return item._id;
    if (item.tempId) return item.tempId;
    return `msg-${index}-${item.createdAt || Date.now()}`;
  }, []);

  /** Loading indicator shown while fetching older messages */
  const ListFooterComponent = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.loadingMore}>
        <ActivityIndicator size="small" color="#007AFF" />
      </View>
    );
  }, [loadingMore]);

  /** Empty state shown when there are no messages */
  const ListEmptyComponent = useMemo(
    () => (
      <View style={styles.emptyView}>
        <Ionicons name="chatbubbles-outline" size={60} color="#C7C7CC" />
        <Text style={styles.emptyTitle}>No messages yet</Text>
        <Text style={styles.emptySubtitle}>
          Send a message to start the conversation
        </Text>
      </View>
    ),
    [],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  /** Full-screen loading spinner while messages are being fetched */
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ChatHeader
        otherUserName={otherUserName}
        otherUserId={otherUserId}
        otherUserAvatar={otherUserAvatar}
        isOnline={isOnline}
        DEFAULT_AVATAR={DEFAULT_AVATAR}
        getFullImageUrl={getFullImageUrl}
      />
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          inverted
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.3}
          removeClippedSubviews={true}
          maxToRenderPerBatch={8}
          windowSize={7}
          initialNumToRender={12}
          updateCellsBatchingPeriod={50}
          ListFooterComponent={ListFooterComponent}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
            autoscrollToTopThreshold: 10,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={
            messages.length === 0 ? styles.emptyList : styles.listContent
          }
          ListEmptyComponent={ListEmptyComponent}
        />
        <ReplyIndicator
          replyToMessage={replyToMessage}
          onCancelReply={cancelReply}
        />
        <ChatInput
          ref={inputRef}
          onSendMessage={handleSendMessage}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          uploading={uploading}
          socketConnected={socketConnected}
          onAttachmentsSelected={handleAttachmentsSelected}
          onLocationShared={handleLocationShared}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// -----------------------------------------------------------------------------
// Styles
// -----------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#fff",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  kav: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 16,
  },
  emptyList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  loadingMore: {
    paddingVertical: 10,
    alignItems: "center",
  },
  emptyView: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: "#333",
    marginBottom: 10,
    fontFamily: "SofiaSans-Bold",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#999",
    textAlign: "center" as const,
    fontFamily: "SofiaSans-Regular",
  },
});
