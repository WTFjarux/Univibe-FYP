// hooks/chatScreen/useMessageSender.ts

import { useCallback } from "react";
import { Alert } from "react-native";
import chatApi from "../../lib/services/chatApi";
import { generateTempId } from "../../lib/utils/messageIdGenerator";
import { detectReplyType } from "../../lib/utils/chatUtils";
import type {
  Message,
  ReplyToState,
  ReplyToData,
  AttachmentData,
  PendingMessage,
} from "../../lib/types/chat.types";

const SEND_TIMEOUT_MS = 10000;

interface UseMessageSenderProps {
  token: string | null;
  roomId: string;
  userId?: string;
  userName?: string;
  socketConnected: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addPendingMessage: (tempId: string, pending: PendingMessage) => void;
  removePendingMessage: (tempId: string) => void;
  setPendingTimeout: (tempId: string, timeout: number) => void;
  scrollToEnd: () => void;
  emitEvent: (event: string, data: any) => void;
}

export const useMessageSender = ({
  token,
  roomId,
  userId,
  userName,
  socketConnected,
  setMessages,
  addPendingMessage,
  removePendingMessage,
  setPendingTimeout,
  scrollToEnd,
  emitEvent,
}: UseMessageSenderProps) => {
  const buildReplyData = useCallback(
    (replyTo: ReplyToState | null): ReplyToData | undefined => {
      if (!replyTo) return undefined;
      return {
        messageId: replyTo._id,
        message: replyTo.message.substring(0, 100),
        senderName: replyTo.senderName,
        senderId: replyTo.senderId,
        type: replyTo.type || detectReplyType(replyTo),
        mediaUrl: replyTo.mediaUrl,
        duration: replyTo.duration,
      };
    },
    [],
  );

  // ============================================
  // SEND TEXT
  // ============================================

  const sendTextMessage = useCallback(
    (text: string, replyTo: ReplyToState | null, onSent: () => void) => {
      if (!text.trim() || !socketConnected) {
        if (!socketConnected)
          Alert.alert("Error", "Not connected to chat server");
        return;
      }

      const tempId = generateTempId();
      const replyToData = buildReplyData(replyTo);

      const tempMessage: Message = {
        _id: tempId,
        tempId,
        sender: userId || "",
        senderName: userName || "You",
        message: text,
        roomId,
        createdAt: new Date().toISOString(),
        status: "sending",
        type: "text",
        replyTo: replyToData,
        reactions: [],
      };

      addPendingMessage(tempId, {
        tempId,
        message: text,
        timestamp: Date.now(),
        type: "text",
        replyTo: replyToData,
      });
      setMessages((prev) => [...prev, tempMessage]);
      scrollToEnd();
      onSent();

      emitEvent("send_message", {
        roomId,
        message: text,
        type: "text",
        replyTo: replyToData,
        tempId,
      });

      const timeout = setTimeout(() => {
        removePendingMessage(tempId);
        Alert.alert("Error", "Message failed to send. Please try again.");
      }, SEND_TIMEOUT_MS);
      setPendingTimeout(tempId, timeout);
    },
    [
      socketConnected,
      userId,
      userName,
      roomId,
      buildReplyData,
      addPendingMessage,
      setMessages,
      scrollToEnd,
      emitEvent,
      removePendingMessage,
      setPendingTimeout,
    ],
  );

  // ============================================
  // SEND AUDIO
  // ============================================

  const sendAudioMessage = useCallback(
    async (
      uri: string,
      duration: number,
      replyTo: ReplyToState | null,
      onSent: () => void,
      setUploading: (v: boolean) => void,
    ) => {
      if (!token) return;

      const tempId = generateTempId();
      const replyToData = buildReplyData(replyTo);

      const tempMessage: Message = {
        _id: tempId,
        tempId,
        sender: userId || "",
        senderName: userName || "You",
        message: "🎤 Voice message",
        roomId,
        createdAt: new Date().toISOString(),
        status: "sending",
        type: "audio",
        duration,
        replyTo: replyToData,
        reactions: [],
      };

      addPendingMessage(tempId, {
        tempId,
        message: "🎤 Voice message",
        timestamp: Date.now(),
        type: "audio",
        duration,
        replyTo: replyToData,
      });
      setMessages((prev) => [...prev, tempMessage]);
      scrollToEnd();
      setUploading(true);
      onSent();

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

        if (replyTo) {
          formData.append("replyToId", replyTo._id);
          formData.append("replyToMessage", replyTo.message.substring(0, 100));
          formData.append("replyToSender", replyTo.senderName);
          formData.append("replyToSenderId", replyTo.senderId || "");
          formData.append(
            "replyToType",
            replyTo.type || detectReplyType(replyTo),
          );
          if (replyTo.mediaUrl)
            formData.append("replyToMediaUrl", replyTo.mediaUrl);
          if (replyTo.duration)
            formData.append("replyToDuration", replyTo.duration.toString());
        }

        const data = await chatApi.uploadAudio(token, formData);

        if (data.success) {
          emitEvent("send_message", {
            roomId,
            message: "🎤 Voice message",
            type: "audio",
            replyTo: replyToData,
            mediaUrl: data.url,
            duration,
            tempId,
          });
        } else {
          removePendingMessage(tempId);
          Alert.alert("Error", data.message || "Failed to send voice message");
        }
      } catch {
        removePendingMessage(tempId);
        Alert.alert("Error", "Failed to send voice message");
      } finally {
        setUploading(false);
      }
    },
    [
      token,
      userId,
      userName,
      roomId,
      buildReplyData,
      addPendingMessage,
      setMessages,
      scrollToEnd,
      emitEvent,
      removePendingMessage,
    ],
  );

  // ============================================
  // SEND ATTACHMENTS
  // ============================================

  const sendAttachments = useCallback(
    async (
      attachments: AttachmentData[],
      setUploading: (v: boolean) => void,
    ) => {
      if (attachments.length === 0 || !token) return;

      try {
        setUploading(true);
        scrollToEnd();

        const allImages = attachments.every((a) => a.type === "image");
        const groupId =
          attachments.length > 1 && allImages
            ? `group_${Date.now()}`
            : undefined;

        const tempMessages: Message[] = attachments.map(
          (attachment, index) => ({
            _id: generateTempId(),
            tempId: generateTempId(),
            sender: userId || "",
            senderName: userName || "You",
            message:
              attachment.type === "image"
                ? "📷 Photo"
                : attachment.type === "video"
                  ? "🎥 Video"
                  : `📎 ${attachment.name || "File"}`,
            roomId,
            createdAt: new Date().toISOString(),
            status: "sending" as const,
            type: (attachment.type === "document"
              ? "file"
              : attachment.type) as Message["type"],
            mediaUrl: attachment.uri,
            mediaName: attachment.name,
            mediaSize: attachment.size,
            groupId,
            groupIndex: groupId ? index : undefined,
            groupTotal: groupId ? attachments.length : undefined,
            reactions: [],
          }),
        );

        setMessages((prev) => [...prev, ...tempMessages]);

        const formData = new FormData();
        attachments.forEach((attachment, index) => {
          formData.append("attachments", {
            uri: attachment.uri,
            name: attachment.name || `file_${Date.now()}_${index}`,
            type: attachment.mimeType || "application/octet-stream",
          } as any);
        });
        formData.append("roomId", roomId);

        const data = await chatApi.uploadAttachments(token, formData);

        if (data.success && data.data) {
          setMessages((prev) =>
            prev.map((msg) => {
              if (msg.status === "sending") {
                const serverMsg = data.data!.find(
                  (m: any) => m.mediaName === msg.mediaName,
                );
                if (serverMsg) {
                  return {
                    ...msg,
                    ...serverMsg,
                    status: "sent" as const,
                    _id: serverMsg._id,
                  };
                }
              }
              return msg;
            }),
          );
        } else {
          setMessages((prev) => prev.filter((msg) => msg.status !== "sending"));
          Alert.alert("Error", "Failed to send attachments");
        }
      } catch {
        setMessages((prev) => prev.filter((msg) => msg.status !== "sending"));
        Alert.alert("Error", "Failed to send attachments");
      } finally {
        setUploading(false);
      }
    },
    [token, userId, userName, roomId, setMessages, scrollToEnd],
  );

  // ============================================
  // SEND LOCATION
  // ============================================

  const sendLocation = useCallback(
    (location: AttachmentData) => {
      const tempId = generateTempId();
      const tempMessage: Message = {
        _id: tempId,
        tempId,
        sender: userId || "",
        senderName: userName || "You",
        message: `📍 ${location.locationName || "Location"}`,
        roomId,
        createdAt: new Date().toISOString(),
        status: "sending",
        type: "location",
        reactions: [],
      };

      setMessages((prev) => [...prev, tempMessage]);
      scrollToEnd();

      emitEvent("send_message", {
        roomId,
        message: `📍 ${location.locationName}`,
        type: "location",
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: location.locationName,
        tempId,
      });
    },
    [userId, userName, roomId, setMessages, scrollToEnd, emitEvent],
  );

  return { sendTextMessage, sendAudioMessage, sendAttachments, sendLocation };
};
