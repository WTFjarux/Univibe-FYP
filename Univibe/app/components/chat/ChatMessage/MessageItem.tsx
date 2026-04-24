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
  messages?: any[];
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
}: MessageItemProps) {
  const messageRef = useRef<View>(null);

  useEffect(() => {
    if (item._id && !item._id.startsWith("temp_") && messageRef.current) {
      registerMessageRef(item._id, messageRef as React.RefObject<View>);
    }
  }, [item._id, registerMessageRef]);

  return (
    <View ref={messageRef} collapsable={false} style={styles.margin}>
      <SwipeableChatMessage
        message={item}
        isOwnMessage={isOwnMessage}
        showAvatar={showAvatar}
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
      />
    </View>
  );
}

const styles = StyleSheet.create({
  margin: { marginVertical: 4 },
});
