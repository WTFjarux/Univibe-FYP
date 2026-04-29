// hooks/chatScreen/useAttachmentUploads.ts

import { useState, useCallback } from "react";
import { Alert } from "react-native";
import chatApi from "../../lib/services/chatApi";
import { generateTempId } from "../../lib/utils/messageIdGenerator";
import {
  validateVideoSize,
  createVideoThumbnail,
  getVideoInfo,
} from "../../lib/utils/videoUtils";
import type {
  Message,
  AttachmentData,
  ProcessedAttachment,
  AttachmentType,
} from "../../lib/types/chat.types";

// ============================================
// TYPES
// ============================================

interface UseAttachmentUploadsProps {
  token: string | null;
  roomId: string;
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
  scrollToEnd: () => void;
}

interface UseAttachmentUploadsReturn {
  sendAttachments: (
    attachments: AttachmentData[],
    setUploading: (v: boolean) => void,
  ) => Promise<void>;
}

// ============================================
// CONSTANTS
// ============================================

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
];

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/x-msvideo",
  "video/webm",
];

const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "application/zip",
  "application/x-rar-compressed",
];

const MAX_FILE_SIZE_MB = {
  image: 50,
  video: 200,
  document: 50,
  default: 50,
};

// ============================================
// HOOK
// ============================================

export const useAttachmentUploads = ({
  token,
  roomId,
  addOptimisticMessage,
  removeOptimisticMessage,
  confirmOptimisticMessage,
  scrollToEnd,
}: UseAttachmentUploadsProps): UseAttachmentUploadsReturn => {
  // ============================================
  // ERROR HANDLING
  // ============================================

  const showErrorAlert = useCallback((title: string, message: string) => {
    Alert.alert(title, message);
  }, []);

  // ============================================
  // VALIDATION
  // ============================================

  const validateImage = useCallback(
    (attachment: AttachmentData): boolean => {
      if (!attachment.size) return true;
      const sizeMB = attachment.size / (1024 * 1024);
      if (sizeMB > MAX_FILE_SIZE_MB.image) {
        showErrorAlert(
          "Image Too Large",
          `Image size (${sizeMB.toFixed(1)}MB) exceeds the ${MAX_FILE_SIZE_MB.image}MB limit.`,
        );
        return false;
      }
      return true;
    },
    [showErrorAlert],
  );

  const validateDocument = useCallback(
    (attachment: AttachmentData): boolean => {
      if (!attachment.size) return true;
      const sizeMB = attachment.size / (1024 * 1024);
      if (sizeMB > MAX_FILE_SIZE_MB.document) {
        showErrorAlert(
          "File Too Large",
          `File size (${sizeMB.toFixed(1)}MB) exceeds the ${MAX_FILE_SIZE_MB.document}MB limit.`,
        );
        return false;
      }
      return true;
    },
    [showErrorAlert],
  );

  const validateLocation = useCallback(
    (attachment: AttachmentData): boolean => {
      if (attachment.type !== "location") return true;
      if (!attachment.latitude || !attachment.longitude) {
        showErrorAlert(
          "Invalid Location",
          "Location data is missing or invalid.",
        );
        return false;
      }
      return true;
    },
    [showErrorAlert],
  );

  // ============================================
  // TYPE DETECTION
  // ============================================

  const detectAttachmentType = useCallback(
    (attachment: AttachmentData): AttachmentType => {
      const validTypes: AttachmentType[] = [
        "image",
        "video",
        "file",
        "document",
        "location",
        "audio",
      ];
      if (validTypes.includes(attachment.type as AttachmentType)) {
        return attachment.type as AttachmentType;
      }

      const mimeType = attachment.mimeType || "";
      if (mimeType.startsWith("image/")) return "image";
      if (mimeType.startsWith("video/")) return "video";
      if (mimeType.startsWith("audio/")) return "audio";
      if (ALLOWED_DOCUMENT_TYPES.includes(mimeType)) return "file";

      const name = (attachment.name || "").toLowerCase();
      const imageExts = [
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".webp",
        ".heic",
        ".heif",
      ];
      const videoExts = [".mp4", ".mov", ".avi", ".webm", ".3gp", ".mkv"];

      if (imageExts.some((ext) => name.endsWith(ext))) return "image";
      if (videoExts.some((ext) => name.endsWith(ext))) return "video";

      return "file";
    },
    [],
  );

  // ============================================
  // MESSAGE TEXT HELPERS
  // ============================================

  const getMessageText = useCallback(
    (attachment: ProcessedAttachment): string => {
      switch (attachment.type) {
        case "image":
          return "Photo";
        case "video":
          return "Video";
        case "location":
          return `Location: ${attachment.locationName || ""}`;
        default:
          return attachment.name || "File";
      }
    },
    [],
  );

  const getMessageType = useCallback(
    (attachment: ProcessedAttachment): string => {
      if (attachment.type === "document") return "file";
      return attachment.type || "file";
    },
    [],
  );

  // ============================================
  // ATTACHMENT PROCESSING
  // ============================================

  const processVideoAttachment = useCallback(
    async (attachment: AttachmentData): Promise<ProcessedAttachment> => {
      if (!attachment.uri) {
        showErrorAlert("Error", "Video file not found");
        throw new Error("Video URI is missing");
      }

      const validation = await validateVideoSize(attachment.uri);

      if (!validation.isValid) {
        showErrorAlert(
          "Video Too Large",
          validation.message || "This video cannot be uploaded.",
        );
        throw new Error(validation.message);
      }

      return {
        ...attachment,
        type: "video" as AttachmentType,
        needsCompression: false,
      };
    },
    [showErrorAlert],
  );

  const processDocumentAttachment = useCallback(
    async (attachment: AttachmentData): Promise<ProcessedAttachment> => {
      if (!validateDocument(attachment)) {
        throw new Error("Document validation failed");
      }
      return {
        ...attachment,
        type: "file" as AttachmentType,
        needsCompression: false,
      };
    },
    [validateDocument],
  );

  const processLocationAttachment = useCallback(
    async (attachment: AttachmentData): Promise<ProcessedAttachment> => {
      if (!validateLocation(attachment)) {
        throw new Error("Location validation failed");
      }
      return {
        ...attachment,
        type: "location" as AttachmentType,
        needsCompression: false,
      };
    },
    [validateLocation],
  );

  const processImageAttachment = useCallback(
    async (attachment: AttachmentData): Promise<ProcessedAttachment> => {
      if (!validateImage(attachment)) {
        throw new Error("Image validation failed");
      }
      return {
        ...attachment,
        type: "image" as AttachmentType,
        needsCompression: false,
      };
    },
    [validateImage],
  );

  // ============================================
  // PROCESSING DISPATCHER
  // ============================================

  const processSingleAttachment = useCallback(
    async (attachment: AttachmentData): Promise<ProcessedAttachment> => {
      const detectedType = detectAttachmentType(attachment);

      const attachmentWithType: AttachmentData = {
        ...attachment,
        type: detectedType,
      };

      switch (detectedType) {
        case "image":
          return processImageAttachment(attachmentWithType);
        case "video":
          return processVideoAttachment(attachmentWithType);
        case "location":
          return processLocationAttachment(attachmentWithType);
        case "file":
        case "document":
          return processDocumentAttachment(attachmentWithType);
        default:
          console.warn(
            `Unknown attachment type: ${detectedType}, treating as file`,
          );
          const fallbackAttachment: AttachmentData = {
            ...attachment,
            type: "file" as AttachmentType,
          };
          return processDocumentAttachment(fallbackAttachment);
      }
    },
    [
      detectAttachmentType,
      processImageAttachment,
      processVideoAttachment,
      processLocationAttachment,
      processDocumentAttachment,
    ],
  );

  const processAttachments = useCallback(
    async (attachments: AttachmentData[]): Promise<ProcessedAttachment[]> => {
      const processed = await Promise.all(
        attachments.map((attachment) => processSingleAttachment(attachment)),
      );
      return processed;
    },
    [processSingleAttachment],
  );

  // ============================================
  // OPTIMISTIC MESSAGES
  // ============================================

  const createOptimisticMessages = useCallback(
    (attachments: ProcessedAttachment[]): string[] => {
      const allImages = attachments.every((a) => a.type === "image");
      const allVideos = attachments.every((a) => a.type === "video");

      const groupId =
        attachments.length > 1 && (allImages || allVideos)
          ? `group_${Date.now()}`
          : undefined;

      const tempIds: string[] = [];

      attachments.forEach((attachment, index) => {
        const tempId = generateTempId();
        tempIds.push(tempId);

        const messageData: Partial<Message> = {
          message: getMessageText(attachment),
          type: getMessageType(attachment) as any,
          mediaUrl: attachment.uri || "",
          mediaName: attachment.name || undefined,
          mediaSize: attachment.size || undefined,
          createdAt: new Date().toISOString(),
        };

        if (groupId) {
          messageData.groupId = groupId;
          messageData.groupIndex = index;
          messageData.groupTotal = attachments.length;
        }

        if (attachment.type === "location") {
          messageData.locationData = {
            latitude: attachment.latitude || 0,
            longitude: attachment.longitude || 0,
            locationName: attachment.locationName || "",
          };
        }

        if (attachment.duration) {
          messageData.duration = attachment.duration;
        }

        addOptimisticMessage(tempId, messageData);
      });

      return tempIds;
    },
    [addOptimisticMessage, getMessageText, getMessageType],
  );

  // ============================================
  // FORM DATA
  // ============================================

  const buildFormData = useCallback(
    (attachments: ProcessedAttachment[], roomId: string): FormData => {
      const formData = new FormData();

      const hasLocation = attachments.some((a) => a.type === "location");
      if (
        hasLocation &&
        attachments.length === 1 &&
        attachments[0].type === "location"
      ) {
        formData.append("type", "location");
        formData.append("roomId", roomId);
        formData.append(
          "locationData",
          JSON.stringify({
            latitude: attachments[0].latitude,
            longitude: attachments[0].longitude,
            locationName: attachments[0].locationName || "",
          }),
        );
        return formData;
      }

      attachments.forEach((attachment, index) => {
        if (attachment.type === "location") return;

        formData.append("attachments", {
          uri: attachment.uri,
          name: attachment.name || `file_${Date.now()}_${index}`,
          type: attachment.mimeType || "application/octet-stream",
        } as any);

        if (attachment.duration) {
          formData.append("duration", attachment.duration.toString());
        }
      });

      formData.append("roomId", roomId);
      return formData;
    },
    [],
  );

  // ============================================
  // MAIN UPLOAD FUNCTION
  // ============================================

  const sendAttachments = useCallback(
    async (
      attachments: AttachmentData[],
      setUploading: (v: boolean) => void,
    ) => {
      if (attachments.length === 0) {
        showErrorAlert("No Files", "Please select files to send.");
        return;
      }

      if (!token) {
        showErrorAlert(
          "Authentication Error",
          "You must be logged in to send files.",
        );
        return;
      }

      let tempIds: string[] = [];

      try {
        const processedAttachments = await processAttachments(attachments);

        if (processedAttachments.length === 0) {
          return;
        }

        setUploading(true);
        scrollToEnd();

        tempIds = createOptimisticMessages(processedAttachments);

        const formData = buildFormData(processedAttachments, roomId);
        const response = await chatApi.uploadAttachments(formData);

        if (response.success && response.data) {
          response.data.forEach((serverMsg: any, index: number) => {
            const tempId = tempIds[index];
            if (tempId && serverMsg._id) {
              confirmOptimisticMessage(tempId, serverMsg._id, serverMsg);
            }
          });
        } else {
          tempIds.forEach((id) => removeOptimisticMessage(id));
          showErrorAlert(
            "Upload Failed",
            response.message || "Failed to send attachments",
          );
        }
      } catch (error: any) {
        console.error("Attachment upload error:", error);

        tempIds.forEach((id) => removeOptimisticMessage(id));

        if (
          error.message?.includes("Video Too Large") ||
          error.message?.includes("too large") ||
          error.message?.includes("validation failed")
        ) {
          return;
        }

        if (
          error.message?.includes("Network") ||
          error.message?.includes("fetch")
        ) {
          showErrorAlert("Network Error", "Could not connect to server.");
        } else {
          showErrorAlert(
            "Upload Failed",
            "Failed to send attachments. Please try again.",
          );
        }
      } finally {
        setUploading(false);
      }
    },
    [
      token,
      roomId,
      processAttachments,
      createOptimisticMessages,
      buildFormData,
      confirmOptimisticMessage,
      removeOptimisticMessage,
      scrollToEnd,
      showErrorAlert,
    ],
  );

  // ============================================
  // RETURN
  // ============================================

  return { sendAttachments };
};
