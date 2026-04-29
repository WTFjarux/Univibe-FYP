// hooks/chatScreen/useMessageSender.ts

import { useCallback } from "react";
import { Alert } from "react-native";
import chatApi from "../../lib/services/chatApi";
import { generateTempId } from "../../lib/utils/messageIdGenerator";
import { detectReplyType } from "../../lib/utils/chatUtils";
import { useAttachmentUploads } from "./useAttachmentUploads";
import type {
  Message,
  ReplyToState,
  ReplyToData,
  AttachmentData,
} from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const SEND_TIMEOUT_MS = 10000;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface UseMessageSenderProps {
  token: string | null;
  roomId: string;
  userId?: string;
  userName?: string;
  socketConnected: boolean;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addOptimisticMessage: (
    tempId: string,
    messageData: Partial<Message>,
  ) => Message;
  removeOptimisticMessage: (tempId: string) => void;
  confirmOptimisticMessage: (
    tempId: string,
    messageId: string,
    serverData?: Partial<Message>,
  ) => void;
  setPendingTimeout: (
    tempId: string,
    timeout: ReturnType<typeof setTimeout>,
  ) => void;
  scrollToEnd: () => void;
  emitEvent: (event: string, data: any) => void;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export const useMessageSender = ({
  token,
  roomId,
  socketConnected,
  addOptimisticMessage,
  removeOptimisticMessage,
  confirmOptimisticMessage,
  setPendingTimeout,
  scrollToEnd,
  emitEvent,
}: UseMessageSenderProps) => {
  // ---------------------------------------------------------------------------
  // Attachment uploads (delegated to dedicated hook)
  // ---------------------------------------------------------------------------

  const { sendAttachments } = useAttachmentUploads({
    token,
    roomId,
    addOptimisticMessage,
    removeOptimisticMessage,
    confirmOptimisticMessage,
    scrollToEnd,
  });

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

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
        thumbnailUrl: replyTo.thumbnailUrl,
        duration: replyTo.duration,
      };
    },
    [],
  );

  const scheduleTimeout = useCallback(
    (tempId: string) => {
      const timeout = setTimeout(() => {
        removeOptimisticMessage(tempId);
        Alert.alert("Error", "Message failed to send. Please try again.");
      }, SEND_TIMEOUT_MS);
      setPendingTimeout(tempId, timeout);
    },
    [removeOptimisticMessage, setPendingTimeout],
  );

  // ---------------------------------------------------------------------------
  // Send Text Message
  // ---------------------------------------------------------------------------

  const sendTextMessage = useCallback(
    (text: string, replyTo: ReplyToState | null, onSent: () => void) => {
      if (!text.trim() || !socketConnected) {
        if (!socketConnected)
          Alert.alert("Error", "Not connected to chat server");
        return;
      }

      const tempId = generateTempId();
      const replyToData = buildReplyData(replyTo);

      addOptimisticMessage(tempId, {
        message: text,
        type: "text",
        replyTo: replyToData,
        createdAt: new Date().toISOString(),
      });

      scrollToEnd();
      onSent();

      emitEvent("send_message", {
        roomId,
        message: text,
        type: "text",
        replyTo: replyToData,
        tempId,
      });

      scheduleTimeout(tempId);
    },
    [
      socketConnected,
      roomId,
      buildReplyData,
      addOptimisticMessage,
      scrollToEnd,
      emitEvent,
      scheduleTimeout,
    ],
  );

  // ---------------------------------------------------------------------------
  // Send Audio Message
  // ---------------------------------------------------------------------------

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

      addOptimisticMessage(tempId, {
        message: "Voice message",
        type: "audio",
        mediaUrl: uri,
        duration,
        replyTo: replyToData,
        createdAt: new Date().toISOString(),
      });

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

        const data = await chatApi.uploadAudio(formData);

        if (data.success) {
          if (data.data && data.data._id) {
            confirmOptimisticMessage(tempId, data.data._id, data.data);
          }
        } else {
          removeOptimisticMessage(tempId);
          Alert.alert("Error", data.message || "Failed to send voice message");
        }
      } catch (error) {
        removeOptimisticMessage(tempId);
        Alert.alert("Error", "Failed to send voice message");
      } finally {
        setUploading(false);
      }
    },
    [
      token,
      roomId,
      buildReplyData,
      addOptimisticMessage,
      removeOptimisticMessage,
      confirmOptimisticMessage,
      scrollToEnd,
    ],
  );

  // ---------------------------------------------------------------------------
  // Send Location
  // ---------------------------------------------------------------------------

  const sendLocation = useCallback(
    (location: AttachmentData) => {
      const tempId = generateTempId();
      const messageText = `📍 ${location.locationName || "Location"}`;

      addOptimisticMessage(tempId, {
        message: messageText,
        type: "location",
        createdAt: new Date().toISOString(),
      });

      scrollToEnd();

      emitEvent("send_message", {
        roomId,
        message: messageText,
        type: "location",
        latitude: location.latitude,
        longitude: location.longitude,
        locationName: location.locationName,
        tempId,
      });

      scheduleTimeout(tempId);
    },
    [roomId, addOptimisticMessage, scrollToEnd, emitEvent, scheduleTimeout],
  );

  return {
    sendTextMessage,
    sendAudioMessage,
    sendAttachments,
    sendLocation,
  };
};
