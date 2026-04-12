// app/components/chat/ChatMessage.tsx
import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { API_BASE_URL } from "../../../constants/ipConstants";

interface Message {
  _id: string;
  sender: string;
  senderName: string;
  senderAvatar?: string;
  message: string;
  roomId: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read";
}

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
  showAvatar: boolean;
  showTime: boolean;
  previousMessageSender?: string;
  nextMessageSender?: string;
}

const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));

  if (hours < 24) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (hours < 48) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString();
  }
};

const getInitials = (name: string): string => {
  return name.charAt(0).toUpperCase();
};

export default function ChatMessage({
  message,
  isOwnMessage,
  showAvatar,
  showTime,
}: ChatMessageProps) {
  return (
    <View
      style={[
        styles.messageWrapper,
        isOwnMessage ? styles.ownMessageWrapper : styles.otherMessageWrapper,
      ]}
    >
      {!isOwnMessage && showAvatar && (
        <View style={styles.avatarContainer}>
          {message.senderAvatar ? (
            <Image
              source={{
                uri: message.senderAvatar.startsWith("http")
                  ? message.senderAvatar
                  : `${API_BASE_URL}${message.senderAvatar}`,
              }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarText}>
                {getInitials(message.senderName)}
              </Text>
            </View>
          )}
        </View>
      )}
      {!isOwnMessage && !showAvatar && <View style={styles.avatarSpacer} />}

      <View
        style={[
          styles.messageContainer,
          isOwnMessage
            ? styles.ownMessageContainer
            : styles.otherMessageContainer,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
            ]}
          >
            {message.message}
          </Text>
        </View>
        {showTime && (
          <View style={styles.messageFooter}>
            <Text style={styles.messageTime}>
              {formatTime(message.createdAt)}
            </Text>
            {isOwnMessage && message.status && (
              <View style={styles.statusContainer}>
                {message.status === "sent" && (
                  <Ionicons name="checkmark" size={12} color="#8E8E93" />
                )}
                {message.status === "delivered" && (
                  <Ionicons name="checkmark-done" size={12} color="#8E8E93" />
                )}
                {message.status === "read" && (
                  <Ionicons name="checkmark-done" size={12} color="#34C759" />
                )}
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  messageWrapper: {
    flexDirection: "row",
    marginBottom: 4,
  },
  ownMessageWrapper: {
    justifyContent: "flex-end",
  },
  otherMessageWrapper: {
    justifyContent: "flex-start",
  },
  avatarContainer: {
    marginRight: 8,
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  avatarPlaceholder: {
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  avatarSpacer: {
    width: 40,
    marginRight: 8,
  },
  messageContainer: {
    maxWidth: "75%",
  },
  ownMessageContainer: {
    alignItems: "flex-end",
  },
  otherMessageContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ownBubble: {
    backgroundColor: "#007AFF",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#E5E5EA",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  ownMessageText: {
    color: "#fff",
  },
  otherMessageText: {
    color: "#000",
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    marginHorizontal: 4,
    gap: 4,
  },
  messageTime: {
    fontSize: 10,
    color: "#8E8E93",
  },
  statusContainer: {
    marginLeft: 4,
  },
});
