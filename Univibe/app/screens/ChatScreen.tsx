// app/screens/ChatScreen.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Animated,
  Dimensions,
  Image,
} from "react-native";
import { StyleSheet } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/contexts/AuthContext";
import { socketService } from "../../lib/services";
import { API_BASE_URL } from "../../constants/ipConstants";
import { SafeAreaView } from "react-native-safe-area-context";
import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import ChatHeader from "../components/chat/ChatMessage/ChatHeader";
import ChatInput, {
  AttachmentData,
} from "../components/chat/ChatMessage/ChatInput";
import ReplyIndicator from "../components/chat/ChatMessage/ReplyIndicator";
import MessageItem from "../components/chat/ChatMessage/MessageItem";
import DateSeparator from "../components/chat/ChatMessage/DateSeparator";
import { useMessageScroll } from "../../hooks/useMessageScroll";
import { generateTempId, isTempId } from "../../lib/utils/messageIdGenerator";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DEFAULT_AVATAR = require("../../assets/images/default-avatar.png");

// ============================================
// TYPES
// ============================================

interface ReplyTo {
  messageId: string;
  message: string;
  senderName: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

interface Message {
  _id: string;
  sender: string | { _id: string; name: string; email?: string };
  senderName: string;
  senderAvatar?: string;
  message: string;
  roomId: string;
  createdAt: string;
  status?: "sent" | "delivered" | "read" | "sending";
  type?: "text" | "image" | "audio" | "video" | "file" | "location";
  mediaUrl?: string;
  mediaSize?: number;
  mediaName?: string;
  mediaMimeType?: string;
  duration?: number;
  locationData?: { latitude: number; longitude: number; locationName: string };
  reactions?: Array<{ userId: string; reaction: string; createdAt: string }>;
  replyTo?: ReplyTo;
  tempId?: string;
  groupId?: string;
  groupIndex?: number;
  groupTotal?: number;
}

interface PendingMessage {
  tempId: string;
  message: string;
  timestamp: number;
  type?: string;
  mediaUrl?: string;
  duration?: number;
  replyTo?: ReplyTo;
}

interface ReplyToState {
  _id: string;
  senderName: string;
  message: string;
  senderId?: string;
  type?: string;
  mediaUrl?: string;
  duration?: number;
}

// ============================================
// CONSTANTS
// ============================================

const MESSAGE_FETCH_LIMIT = 50;
const SEND_TIMEOUT_MS = 10000;
const MIN_RECORDING_SECONDS = 1;
const AUTO_SCROLL_TIMEOUT = 3000;
const SCROLL_TO_MESSAGE_TIMEOUT = 5000;
const MESSAGE_TIME_GAP_MINUTES = 5;

// ============================================
// MAIN COMPONENT
// ============================================

export default function ChatScreen() {
  const params = useLocalSearchParams();
  const { token, user } = useAuth();
  const isMountedRef = useRef(true);

  const roomId = params.roomId as string;
  const otherUserName = params.otherUserName as string;
  let otherUserId = params.otherUserId as string;
  const otherUserAvatar = params.otherUserAvatar as string;

  const extractOtherUserIdFromRoomId = (
    roomId: string,
    currentUserId: string,
  ): string => {
    if (!roomId || !currentUserId) return "";
    const parts = roomId.split("_");
    if (parts.length >= 3)
      return parts[1] === currentUserId ? parts[2] : parts[1];
    return "";
  };

  if (!otherUserId && roomId && user?.id) {
    otherUserId = extractOtherUserIdFromRoomId(roomId, user.id);
  }

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<ReplyToState | null>(
    null,
  );

  // Audio state
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isStoppingRef = useRef(false);

  // Refs
  const pendingMessagesRef = useRef<Map<string, PendingMessage>>(new Map());
  const pendingTimeoutsRef = useRef<Map<string, number>>(new Map());
  const processedMessageIds = useRef<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<any>(null);
  const isInitialLoadRef = useRef(true);
  const autoScrollEnabledRef = useRef(true);
  const isManualScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const {
    highlightedMessageId,
    registerMessageRef,
    scrollToMessage,
    clearHighlight,
    onScroll: onScrollHook,
    onLayout,
  } = useMessageScroll(flatListRef as React.RefObject<FlatList>);

  // ========== HELPERS ==========
  const getFullImageUrl = (url: string): string => {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    if (url.startsWith("/uploads")) return `${API_BASE_URL}${url}`;
    if (url.startsWith("uploads")) return `${API_BASE_URL}/${url}`;
    return `${API_BASE_URL}/uploads/${url}`;
  };

  const formatMessageTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  };

  const formatDateSeparator = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === now.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const isNewDay = (date1: string, date2: string): boolean => {
    const d1 = new Date(date1),
      d2 = new Date(date2);
    return (
      d1.getDate() !== d2.getDate() ||
      d1.getMonth() !== d2.getMonth() ||
      d1.getFullYear() !== d2.getFullYear()
    );
  };

  const getTimeDifferenceInMinutes = (date1: string, date2: string): number => {
    return (
      Math.abs(new Date(date1).getTime() - new Date(date2).getTime()) /
      (1000 * 60)
    );
  };

  const isValidMessage = useCallback((msg: Message): boolean => {
    if (isTempId(msg._id) || msg.status === "sending") return false;
    if (msg.type === "audio" && !msg.mediaUrl) return false;
    return !!msg._id;
  }, []);

  const filterInvalidMessages = useCallback(
    (msgs: Message[]): Message[] => msgs.filter(isValidMessage),
    [isValidMessage],
  );

  const detectReplyType = useCallback((replyTo: ReplyToState): string => {
    if (replyTo.type) return replyTo.type;
    if (
      replyTo.message === "🎤 Voice message" ||
      replyTo.mediaUrl?.includes("audio")
    )
      return "audio";
    if (replyTo.message === "📷 Photo" || replyTo.mediaUrl?.includes("image"))
      return "image";
    return "text";
  }, []);

  const getSenderId = (message: Message): string =>
    typeof message.sender === "string"
      ? message.sender
      : message.sender?._id || "";

  const isOwnMessage = (message: Message): boolean => {
    if (!user?.id) return false;
    if (message.tempId && pendingMessagesRef.current.has(message.tempId))
      return true;
    if (isTempId(message._id)) return true;
    return getSenderId(message).toString() === user.id.toString();
  };

  // ========== SCROLL ==========
  const handleScroll = useCallback(
    (event: any) => {
      onScrollHook(event);
      if (isManualScrollRef.current) {
        isManualScrollRef.current = false;
        if (manualScrollTimeoutRef.current)
          clearTimeout(manualScrollTimeoutRef.current);
      }
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const isNearBottom =
        contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
      if (autoScrollEnabledRef.current) {
        autoScrollEnabledRef.current = false;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          if (isNearBottom) autoScrollEnabledRef.current = true;
          else
            scrollTimeoutRef.current = setTimeout(() => {
              autoScrollEnabledRef.current = true;
            }, 5000);
        }, AUTO_SCROLL_TIMEOUT);
      }
    },
    [onScrollHook],
  );

  // ========== MESSAGE ACTIONS ==========
  const handleReply = useCallback((message: Message) => {
    if (isTempId(message._id) || message.status === "sending") return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReplyToMessage({
      _id: message._id,
      senderName: message.senderName,
      message: message.message,
      senderId: getSenderId(message),
      type: message.type,
      mediaUrl: message.mediaUrl,
      duration: message.duration,
    });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
    clearHighlight();
  }, [clearHighlight]);

  const handleScrollToMessage = useCallback(
    (messageId: string) => {
      isManualScrollRef.current = true;
      autoScrollEnabledRef.current = false;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (manualScrollTimeoutRef.current)
        clearTimeout(manualScrollTimeoutRef.current);
      scrollToMessage(messageId);
      setTimeout(() => {
        isManualScrollRef.current = false;
      }, 1000);
      manualScrollTimeoutRef.current = setTimeout(() => {
        autoScrollEnabledRef.current = true;
      }, SCROLL_TO_MESSAGE_TIMEOUT);
    },
    [scrollToMessage],
  );

  // ========== SEND TEXT MESSAGE ==========
  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !socketConnected) {
        if (!socketConnected)
          Alert.alert("Error", "Not connected to chat server");
        return;
      }
      const tempId = generateTempId();
      const currentReplyTo = replyToMessage;
      autoScrollEnabledRef.current = true;

      const replyToData = currentReplyTo
        ? {
            messageId: currentReplyTo._id,
            message: currentReplyTo.message.substring(0, 100),
            senderName: currentReplyTo.senderName,
            senderId: currentReplyTo.senderId,
            type: currentReplyTo.type || detectReplyType(currentReplyTo),
            mediaUrl: currentReplyTo.mediaUrl,
            duration: currentReplyTo.duration,
          }
        : undefined;

      const tempMessage: Message = {
        _id: tempId,
        tempId,
        sender: user?.id || "",
        senderName: user?.name || "You",
        message: text,
        roomId,
        createdAt: new Date().toISOString(),
        status: "sending",
        type: "text",
        replyTo: replyToData,
      };

      pendingMessagesRef.current.set(tempId, {
        tempId,
        message: text,
        timestamp: Date.now(),
        type: "text",
        replyTo: replyToData,
      });
      setMessages((prev) => [...prev, tempMessage]);
      flatListRef.current?.scrollToEnd();
      setReplyToMessage(null);

      socketService.emit("send_message", {
        roomId,
        message: text,
        type: "text",
        replyTo: replyToData,
        tempId,
      });

      const timeout = setTimeout(() => {
        if (pendingMessagesRef.current.has(tempId)) {
          pendingMessagesRef.current.delete(tempId);
          setMessages((prev) =>
            prev.filter((msg) => msg.tempId !== tempId && msg._id !== tempId),
          );
          Alert.alert("Error", "Message failed to send. Please try again.");
        }
        pendingTimeoutsRef.current.delete(tempId);
      }, SEND_TIMEOUT_MS);
      pendingTimeoutsRef.current.set(tempId, timeout);
    },
    [socketConnected, replyToMessage, user, roomId, detectReplyType],
  );

  // ========== AUDIO ==========
  const startRecording = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync().catch(() => {});
        setRecording(null);
      }
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Permission needed", "Please grant microphone permission");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = setInterval(
        () => setRecordingDuration((prev) => prev + 1),
        1000,
      );
    } catch (err) {
      Alert.alert("Error", "Failed to start recording");
      setIsRecording(false);
      setRecording(null);
    }
  };

  const stopRecording = async (shouldSend = true) => {
    if (!recording || isStoppingRef.current) {
      setIsRecording(false);
      return;
    }
    isStoppingRef.current = true;
    const currentRecording = recording;
    const currentDuration = recordingDuration;
    setRecording(null);
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingDuration(0);
    try {
      await currentRecording.stopAndUnloadAsync();
      if (shouldSend && currentDuration >= MIN_RECORDING_SECONDS) {
        const uri = currentRecording.getURI();
        if (uri) await uploadAndSendAudio(uri, currentDuration);
      } else if (currentDuration < MIN_RECORDING_SECONDS && shouldSend) {
        Alert.alert(
          "Info",
          "Recording too short. Please record at least 1 second.",
        );
      }
    } catch (error) {
      if (shouldSend) Alert.alert("Error", "Failed to save recording");
    } finally {
      isStoppingRef.current = false;
    }
  };

  const cancelRecording = async () => {
    await stopRecording(false);
  };

  const uploadAndSendAudio = async (uri: string, duration: number) => {
    const tempId = generateTempId();
    const currentReplyTo = replyToMessage;
    autoScrollEnabledRef.current = true;

    const replyToData = currentReplyTo
      ? {
          messageId: currentReplyTo._id,
          message: currentReplyTo.message.substring(0, 100),
          senderName: currentReplyTo.senderName,
          senderId: currentReplyTo.senderId,
          type: currentReplyTo.type || detectReplyType(currentReplyTo),
          mediaUrl: currentReplyTo.mediaUrl,
          duration: currentReplyTo.duration,
        }
      : undefined;

    const tempMessage: Message = {
      _id: tempId,
      tempId,
      sender: user?.id || "",
      senderName: user?.name || "You",
      message: "🎤 Voice message",
      roomId,
      createdAt: new Date().toISOString(),
      status: "sending",
      type: "audio",
      duration,
      replyTo: replyToData,
    };

    pendingMessagesRef.current.set(tempId, {
      tempId,
      message: "🎤 Voice message",
      timestamp: Date.now(),
      type: "audio",
      duration,
      replyTo: replyToData,
    });
    setMessages((prev) => [...prev, tempMessage]);
    flatListRef.current?.scrollToEnd();
    setUploading(true);
    setReplyToMessage(null);

    try {
      const formData = new FormData();
      formData.append("audio", {
        uri,
        name: `voice_${Date.now()}.m4a`,
        type: "audio/m4a",
      } as any);
      formData.append("roomId", roomId);
      formData.append("duration", duration.toString());
      formData.append("tempId", tempId);
      if (currentReplyTo) {
        formData.append("replyToId", currentReplyTo._id);
        formData.append(
          "replyToMessage",
          currentReplyTo.message.substring(0, 100),
        );
        formData.append("replyToSender", currentReplyTo.senderName);
        formData.append("replyToSenderId", currentReplyTo.senderId || "");
        formData.append(
          "replyToType",
          currentReplyTo.type || detectReplyType(currentReplyTo),
        );
        if (currentReplyTo.mediaUrl)
          formData.append("replyToMediaUrl", currentReplyTo.mediaUrl);
        if (currentReplyTo.duration)
          formData.append(
            "replyToDuration",
            currentReplyTo.duration.toString(),
          );
      }

      const response = await fetch(`${API_BASE_URL}/api/chat/upload-audio`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await response.json();

      if (data.success && isMountedRef.current) {
        socketService.emit("send_message", {
          roomId,
          message: "🎤 Voice message",
          type: "audio",
          replyTo: replyToData,
          mediaUrl: data.url,
          duration,
          tempId,
        });
      } else if (isMountedRef.current) {
        pendingMessagesRef.current.delete(tempId);
        setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
        Alert.alert("Error", data.message || "Failed to send voice message");
      }
    } catch (error) {
      if (isMountedRef.current) {
        pendingMessagesRef.current.delete(tempId);
        setMessages((prev) => prev.filter((msg) => msg._id !== tempId));
        Alert.alert("Error", "Failed to send voice message");
      }
    } finally {
      if (isMountedRef.current) setUploading(false);
    }
  };

  // ========== 🔴 ATTACHMENTS ==========
  const handleAttachmentsSelected = useCallback(
    async (attachments: AttachmentData[]) => {
      if (attachments.length === 0) return;
      try {
        setAttachmentUploading(true);
        autoScrollEnabledRef.current = true;

        // 🔴 Generate group ID for photos sent together
        const allImages = attachments.every((a) => a.type === "image");
        const groupId =
          attachments.length > 1 && allImages
            ? `group_${Date.now()}`
            : undefined;

        const tempMessages: Message[] = attachments.map(
          (attachment, index) => ({
            _id: generateTempId(),
            tempId: generateTempId(),
            sender: user?.id || "",
            senderName: user?.name || "You",
            message:
              attachment.type === "image"
                ? "📷 Photo"
                : attachment.type === "video"
                  ? "🎥 Video"
                  : `📎 ${attachment.name || "File"}`,
            roomId,
            createdAt: new Date().toISOString(),
            status: "sending",
            type: attachment.type === "document" ? "file" : attachment.type,
            mediaUrl: attachment.uri,
            mediaName: attachment.name,
            mediaSize: attachment.size,
            // 🔴 Group info
            groupId,
            groupIndex: groupId ? index : undefined,
            groupTotal: groupId ? attachments.length : undefined,
          }),
        );

        setMessages((prev) => [...prev, ...tempMessages]);
        flatListRef.current?.scrollToEnd();

        const formData = new FormData();
        attachments.forEach((attachment, index) => {
          formData.append("attachments", {
            uri: attachment.uri,
            name: attachment.name || `file_${Date.now()}_${index}`,
            type: attachment.mimeType || "application/octet-stream",
          } as any);
        });
        formData.append("roomId", roomId);

        const response = await fetch(
          `${API_BASE_URL}/api/chat/upload-attachments`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        const data = await response.json();

        if (data.success) {
          // 🔴 Replace temp messages with server ones (server already broadcasts)
          setMessages((prev) => {
            const updated = prev.map((msg) => {
              if (msg.status === "sending") {
                const serverMsg = data.data.find(
                  (m: any) => m.mediaName === msg.mediaName,
                );
                if (serverMsg) {
                  return {
                    ...msg,
                    ...serverMsg,
                    status: "sent",
                    _id: serverMsg._id,
                  };
                }
              }
              return msg;
            });
            return updated;
          });
          // 🔴 DON'T emit send_message - server already broadcasts via receive_message
        } else {
          setMessages((prev) => prev.filter((msg) => msg.status !== "sending"));
          Alert.alert("Error", "Failed to send attachments");
        }
      } catch (error) {
        setMessages((prev) => prev.filter((msg) => msg.status !== "sending"));
        Alert.alert("Error", "Failed to send attachments");
      } finally {
        setAttachmentUploading(false);
      }
    },
    [roomId, user, token],
  );

  const handleLocationShared = useCallback(
    async (location: AttachmentData) => {
      const tempId = generateTempId();
      const tempMessage: Message = {
        _id: tempId,
        tempId,
        sender: user?.id || "",
        senderName: user?.name || "You",
        message: `📍 ${location.locationName || "Location"}`,
        roomId,
        createdAt: new Date().toISOString(),
        status: "sending",
        type: "location",
      };
      setMessages((prev) => [...prev, tempMessage]);
      flatListRef.current?.scrollToEnd();
      socketService.emit("send_message", {
        roomId,
        message: `📍 ${location.locationName}`,
        type: "location",
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: location.locationName,
        tempId,
      });
    },
    [roomId, user],
  );

  // ========== REACTIONS & DELETE ==========
  const handleReaction = async (
    messageId: string,
    reaction: string,
    shouldRemove?: boolean,
  ) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg._id !== messageId) return msg;
        const currentReactions = msg.reactions || [];
        if (shouldRemove)
          return {
            ...msg,
            reactions: currentReactions.filter((r) => r.userId !== user?.id),
          };
        const existingIndex = currentReactions.findIndex(
          (r) => r.userId === user?.id,
        );
        if (existingIndex !== -1) {
          const updated = [...currentReactions];
          updated[existingIndex] = {
            ...updated[existingIndex],
            reaction,
            createdAt: new Date().toISOString(),
          };
          return { ...msg, reactions: updated };
        }
        return {
          ...msg,
          reactions: [
            ...currentReactions,
            {
              userId: user?.id || "",
              reaction,
              createdAt: new Date().toISOString(),
            },
          ],
        };
      }),
    );
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/message/${messageId}/react`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reaction, remove: shouldRemove || false }),
        },
      );
      const data = await response.json();
      if (data.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, reactions: data.reactions } : msg,
          ),
        );
      } else loadMessages(true);
    } catch (error) {
      Alert.alert("Error", "Failed to update reaction");
      loadMessages(true);
    }
  };

  const handleDelete = async (messageId: string) => {
    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await fetch(
                `${API_BASE_URL}/api/chat/message/${messageId}`,
                {
                  method: "DELETE",
                  headers: { Authorization: `Bearer ${token}` },
                },
              );
              const data = await response.json();
              if (data.success) {
                setMessages((prev) =>
                  prev.filter((msg) => msg._id !== messageId),
                );
                socketService.emit("delete_message", { messageId, roomId });
              }
            } catch (error) {
              Alert.alert("Error", "Failed to delete message");
            }
          },
        },
      ],
    );
  };

  const markAudioAsPlayed = async (messageId: string) => {
    try {
      await fetch(`${API_BASE_URL}/api/chat/audio/${messageId}/played`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (error) {}
  };

  const handleForward = (message: Message) => {
    Alert.alert("Forward", "Forward feature coming soon!");
  };

  // ========== LOAD MESSAGES ==========
  const loadMessages = async (forceRefresh = false) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/chat/messages/${roomId}?limit=${MESSAGE_FETCH_LIMIT}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await response.json();
      if (data.success && isMountedRef.current) {
        const serverMessages = data.data.messages || [];
        const cleanMessages = filterInvalidMessages(serverMessages);
        processedMessageIds.current.clear();
        cleanMessages.forEach((msg) =>
          processedMessageIds.current.add(msg._id),
        );
        const pendingList = Array.from(pendingMessagesRef.current.values());
        const pendingMessages: Message[] = pendingList.map((pending) => ({
          _id: pending.tempId,
          tempId: pending.tempId,
          sender: user?.id || "",
          senderName: user?.name || "You",
          message:
            pending.type === "audio" ? "🎤 Voice message" : pending.message,
          roomId,
          createdAt: new Date(pending.timestamp).toISOString(),
          status: "sending" as const,
          type: pending.type as any,
          mediaUrl: pending.mediaUrl,
          duration: pending.duration,
          replyTo: pending.replyTo,
        }));
        const finalMessages = [
          ...cleanMessages.filter((msg) => !isTempId(msg._id)),
          ...pendingMessages,
        ];
        finalMessages.sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );
        setMessages(finalMessages);
      }
    } catch (error) {
      console.error("Error loading messages:", error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMessages(true);
  };

  // ========== SOCKET SETUP ==========
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (recording) recording.stopAndUnloadAsync().catch(() => {});
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      pendingTimeoutsRef.current.clear();
      pendingMessagesRef.current.clear();
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
      if (manualScrollTimeoutRef.current)
        clearTimeout(manualScrollTimeoutRef.current);
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMessages(true);
      return () => {
        pendingTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
        pendingTimeoutsRef.current.clear();
        setReplyToMessage(null);
        clearHighlight();
      };
    }, []),
  );

  useEffect(() => {
    const check = () => setSocketConnected(socketService.getConnectionStatus());
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    socketService.joinRoom(roomId, otherUserId);
    loadMessages(true);

    socketService.on("message_delivered", (data: any) => {
      const { tempId, messageId, message: messageData, success } = data;
      if (success === false) {
        if (tempId && pendingMessagesRef.current.has(tempId)) {
          pendingMessagesRef.current.delete(tempId);
          const timeout = pendingTimeoutsRef.current.get(tempId);
          if (timeout) clearTimeout(timeout);
          pendingTimeoutsRef.current.delete(tempId);
          setMessages((prev) =>
            prev.filter((msg) => msg.tempId !== tempId && msg._id !== tempId),
          );
          Alert.alert("Error", data.error || "Failed to send message");
        }
        return;
      }
      if (tempId && pendingMessagesRef.current.has(tempId)) {
        pendingMessagesRef.current.delete(tempId);
        const timeout = pendingTimeoutsRef.current.get(tempId);
        if (timeout) clearTimeout(timeout);
        pendingTimeoutsRef.current.delete(tempId);
        setMessages((prev) => {
          const tempIndex = prev.findIndex(
            (msg) => msg.tempId === tempId || msg._id === tempId,
          );
          if (tempIndex !== -1) {
            const newMessages = [...prev];
            newMessages[tempIndex] = {
              ...(messageData || {}),
              _id: messageId,
              status: "sent",
            };
            processedMessageIds.current.add(messageId);
            return newMessages;
          }
          return prev;
        });
      }
    });

    socketService.on("receive_message", (message: Message) => {
      if (message.roomId === roomId && isMountedRef.current) {
        if (
          !isValidMessage(message) ||
          processedMessageIds.current.has(message._id)
        )
          return;
        processedMessageIds.current.add(message._id);
        setMessages((prev) => {
          if (prev.some((msg) => msg._id === message._id)) return prev;
          return [...prev, { ...message, status: "sent" }];
        });
        if (autoScrollEnabledRef.current && !isManualScrollRef.current)
          setTimeout(
            () => flatListRef.current?.scrollToEnd({ animated: true }),
            100,
          );
      }
    });

    socketService.on("user_online", () => setIsOnline(true));
    socketService.on("user_offline", () => setIsOnline(false));

    return () => {
      socketService.off("message_delivered", () => {});
      socketService.off("receive_message", () => {});
      socketService.off("user_online", () => {});
      socketService.off("user_offline", () => {});
    };
  }, [roomId]);

  // ========== RENDER ==========
  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const ownMessage = isOwnMessage(item);

    // 🔴 Group detection
    const prevMessage = index > 0 ? messages[index - 1] : null;
    const nextMessage =
      index < messages.length - 1 ? messages[index + 1] : null;

    // Check if in same group
    const isInGroup = !!(
      item.groupId &&
      (prevMessage?.groupId === item.groupId ||
        nextMessage?.groupId === item.groupId)
    );

    const isFirstInGroup = isInGroup && prevMessage?.groupId !== item.groupId;
    const isLastInGroup = isInGroup && nextMessage?.groupId !== item.groupId;

    // Only show avatar for first in group or non-grouped messages
    const showDateSeparator =
      index === 0 || isNewDay(item.createdAt, messages[index - 1].createdAt);

    const showAvatar =
      !ownMessage &&
      !isInGroup && // 🔴 Don't show avatar for grouped messages
      (index === 0 || getSenderId(messages[index - 1]) !== getSenderId(item));

    const showTime =
      isLastInGroup || // 🔴 Show time on last of group
      (!isInGroup &&
        (index === 0 ||
          getTimeDifferenceInMinutes(
            item.createdAt,
            messages[index - 1].createdAt,
          ) > MESSAGE_TIME_GAP_MINUTES ||
          getSenderId(messages[index - 1]) !== getSenderId(item)));

    return (
      <>
        {showDateSeparator && (
          <DateSeparator date={formatDateSeparator(item.createdAt)} />
        )}
        <MessageItem
          item={item}
          index={index}
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
          onForward={handleForward}
          currentUserId={user?.id}
          highlightedMessageId={highlightedMessageId || undefined}
          onScrollToMessage={handleScrollToMessage}
          registerMessageRef={registerMessageRef}
          // 🔴 Pass grouping info
          isGrouped={isInGroup}
          isFirstInGroup={isFirstInGroup}
          isLastInGroup={isLastInGroup}
        />
      </>
    );
  };

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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          onContentSizeChange={() => {
            if (
              messages.length > 0 &&
              autoScrollEnabledRef.current &&
              !isManualScrollRef.current &&
              !isInitialLoadRef.current
            )
              flatListRef.current?.scrollToEnd({ animated: true });
          }}
          onLayout={(event) => {
            onLayout(event);
            if (isInitialLoadRef.current && messages.length > 0) {
              setTimeout(() => {
                flatListRef.current?.scrollToEnd({ animated: false });
                isInitialLoadRef.current = false;
                autoScrollEnabledRef.current = true;
              }, 100);
            }
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Ionicons name="chatbubbles-outline" size={60} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySubtitle}>
                Send a message to start the conversation
              </Text>
            </View>
          }
        />
        <ReplyIndicator
          replyToMessage={replyToMessage}
          onCancelReply={cancelReply}
        />
        <ChatInput
          ref={inputRef}
          onSendMessage={sendMessage}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          onCancelRecording={cancelRecording}
          isRecording={isRecording}
          recordingDuration={recordingDuration}
          uploading={uploading || attachmentUploading}
          socketConnected={socketConnected}
          onAttachmentsSelected={handleAttachmentsSelected}
          onLocationShared={handleLocationShared}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#fff" },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  kav: { flex: 1, backgroundColor: "#f8f9fa" },
  listContent: { paddingHorizontal: 12, paddingVertical: 16 },
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
