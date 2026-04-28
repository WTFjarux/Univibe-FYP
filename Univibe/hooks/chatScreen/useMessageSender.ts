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
} from "../../lib/types/chat.types";

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/** Maximum time to wait for server confirmation before showing failure */
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

/**
 * Manages sending messages of all types: text, audio, attachments, and location.
 *
 * Each send operation follows the same pattern:
 * 1. Create an optimistic message (shown immediately in the UI)
 * 2. Send via socket or upload API
 * 3. Confirm and update on success, or remove on failure
 */
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
  /**
   * Builds a ReplyToData object from the current reply state.
   * Returns undefined if no message is being replied to.
   */
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

  /**
   * Sets a failure timeout for an optimistic message.
   * If the server doesn't confirm within SEND_TIMEOUT_MS, the message is
   * removed and an error is shown.
   */
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

  /**
   * Sends a text message optimistically via the socket.
   * The message appears immediately and is confirmed when the server responds.
   */
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

  /**
   * Uploads and sends an audio message.
   * The audio file is uploaded via FormData, and the message is confirmed
   * once the server returns the permanent message ID.
   */
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
        message: "🎤 Voice message",
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
  // Send Attachments
  // ---------------------------------------------------------------------------

  /**
   * Uploads and sends one or more attachments (images, videos, files).
   * Multiple images are grouped together with a shared groupId for UI layout.
   * Each attachment gets its own optimistic message and server confirmation.
   */
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

        const tempIds: string[] = [];

        attachments.forEach((attachment, index) => {
          const tempId = generateTempId();
          tempIds.push(tempId);

          const messageText =
            attachment.type === "image"
              ? "📷 Photo"
              : attachment.type === "video"
                ? "🎥 Video"
                : `📎 ${attachment.name || "File"}`;

          addOptimisticMessage(tempId, {
            message: messageText,
            type: attachment.type === "document" ? "file" : attachment.type,
            mediaUrl: attachment.uri,
            mediaName: attachment.name,
            mediaSize: attachment.size,
            groupId,
            groupIndex: groupId ? index : undefined,
            groupTotal: groupId ? attachments.length : undefined,
            createdAt: new Date().toISOString(),
          });
        });

        const formData = new FormData();
        attachments.forEach((attachment, index) => {
          formData.append("attachments", {
            uri: attachment.uri,
            name: attachment.name || `file_${Date.now()}_${index}`,
            type: attachment.mimeType || "application/octet-stream",
          } as any);
        });
        formData.append("roomId", roomId);

        const data = await chatApi.uploadAttachments(formData);

        if (data.success && data.data) {
          data.data.forEach((serverMsg: any, index: number) => {
            const tempId = tempIds[index];
            if (tempId && serverMsg._id) {
              confirmOptimisticMessage(tempId, serverMsg._id, serverMsg);
            }
          });
        } else {
          tempIds.forEach((id) => removeOptimisticMessage(id));
          Alert.alert("Error", "Failed to send attachments");
        }
      } catch {
        Alert.alert("Error", "Failed to send attachments");
      } finally {
        setUploading(false);
      }
    },
    [
      token,
      roomId,
      addOptimisticMessage,
      removeOptimisticMessage,
      confirmOptimisticMessage,
      scrollToEnd,
    ],
  );

  // ---------------------------------------------------------------------------
  // Send Location
  // ---------------------------------------------------------------------------

  /**
   * Sends a shared location message optimistically via the socket.
   * Includes latitude, longitude, and an optional location name.
   */
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

  return { sendTextMessage, sendAudioMessage, sendAttachments, sendLocation };
};
