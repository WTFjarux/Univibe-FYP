// app/components/chat/ChatMessage/MessageItem.tsx

import React, { useRef, useEffect } from "react";
import { View, StyleSheet } from "react-native";
import SwipeableChatMessage from "./SwipeableChatMessage";

interface MessageItemProps {
  item: any;
  index: number;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showTime: boolean;
  formatTime: (dateString: string) => string;
  getFullImageUrl: (url: string) => string;
  DEFAULT_AVATAR: any;
  onAudioPlayed?: (messageId: string) => void;
  onReaction?: (
    messageId: string,
    reaction: string,
    shouldRemove?: boolean,
  ) => void;
  onReply?: (message: any) => void;
  onDelete?: (messageId: string) => void;
  onForward?: (message: any) => void;
  currentUserId?: string;
  highlightedMessageId?: string;
  onScrollToMessage?: (messageId: string) => void;
  registerMessageRef: (messageId: string, ref: React.RefObject<View>) => void;
  // 🔴 Grouping props
  isGrouped?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  messages?: any[]; // Full messages array for group detection
}

export default function MessageItem({
  item,
  isOwnMessage,
  showAvatar,
  showTime,
  formatTime,
  getFullImageUrl,
  DEFAULT_AVATAR,
  onAudioPlayed,
  onReaction,
  onReply,
  onDelete,
  onForward,
  currentUserId,
  highlightedMessageId,
  onScrollToMessage,
  registerMessageRef,
  isGrouped,
  isFirstInGroup,
  isLastInGroup,
}: MessageItemProps) {
  const messageRef = useRef<View>(null);

  useEffect(() => {
    if (item._id && !item._id.startsWith("temp_") && messageRef.current) {
      registerMessageRef(item._id, messageRef as React.RefObject<View>);
    }
  }, [item._id, registerMessageRef]);

  // 🔴 Calculate margin based on grouping
  const getMarginStyle = () => {
    if (!isGrouped) return styles.normalMargin;
    if (isFirstInGroup) return styles.firstInGroup;
    if (isLastInGroup) return styles.lastInGroup;
    return styles.middleInGroup;
  };

  return (
    <View ref={messageRef} collapsable={false} style={getMarginStyle()}>
      <SwipeableChatMessage
        message={item}
        isOwnMessage={isOwnMessage}
        showAvatar={showAvatar && !isGrouped} // 🔴 Hide avatar for grouped messages
        showTime={showTime}
        formatTime={formatTime}
        getFullImageUrl={getFullImageUrl}
        DEFAULT_AVATAR={DEFAULT_AVATAR}
        onAudioPlayed={onAudioPlayed}
        onReaction={onReaction}
        onReply={onReply}
        onDelete={onDelete}
        onForward={onForward}
        currentUserId={currentUserId}
        highlightedMessageId={highlightedMessageId}
        onScrollToMessage={onScrollToMessage}
        isGrouped={isGrouped}
        isFirstInGroup={isFirstInGroup}
        isLastInGroup={isLastInGroup}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  normalMargin: {
    marginVertical: 4,
  },
  firstInGroup: {
    marginTop: 4,
    marginBottom: 0.5,
  },
  middleInGroup: {
    marginVertical: 0.5,
  },
  lastInGroup: {
    marginTop: 0.5,
    marginBottom: 4,
  },
});
