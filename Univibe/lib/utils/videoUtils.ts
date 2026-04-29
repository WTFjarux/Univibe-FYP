// lib/utils/videoUtils.ts

import { File } from "expo-file-system";
import * as VideoThumbnails from "expo-video-thumbnails";
import * as ImageManipulator from "expo-image-manipulator";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const MAX_VIDEO_SIZE_MB = 200;

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface VideoInfo {
  uri: string;
  duration: number;
  width: number;
  height: number;
  size: number;
  sizeMB: number;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const getFileSize = async (uri: string): Promise<number> => {
  try {
    const file = new File(uri);
    const info = file.info();
    return info.size || 0;
  } catch {
    return 0;
  }
};

// -----------------------------------------------------------------------------
// Video Info Extraction
// -----------------------------------------------------------------------------

export const getVideoInfo = async (uri: string): Promise<VideoInfo> => {
  try {
    const thumbnail = await VideoThumbnails.getThumbnailAsync(uri, {
      time: 1000,
    });
    const size = await getFileSize(uri);

    return {
      uri,
      duration: (thumbnail as any).duration ?? 0,
      width: thumbnail.width,
      height: thumbnail.height,
      size,
      sizeMB: size / (1024 * 1024),
    };
  } catch {
    const size = await getFileSize(uri);
    return {
      uri,
      duration: 0,
      width: 1280,
      height: 720,
      size,
      sizeMB: size / (1024 * 1024),
    };
  }
};

// -----------------------------------------------------------------------------
// Thumbnail Generation
// -----------------------------------------------------------------------------

export const createVideoThumbnail = async (
  videoUri: string,
  timeMs: number = 1000,
): Promise<string | null> => {
  try {
    const thumbnail = await VideoThumbnails.getThumbnailAsync(videoUri, {
      time: timeMs,
    });
    const compressed = await ImageManipulator.manipulateAsync(
      thumbnail.uri,
      [{ resize: { width: 400 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG },
    );
    return compressed.uri;
  } catch {
    return null;
  }
};

// -----------------------------------------------------------------------------
// Size Validation
// -----------------------------------------------------------------------------

export const validateVideoSize = async (
  uri: string,
): Promise<{
  isValid: boolean;
  size: number;
  sizeMB: number;
  message?: string;
}> => {
  const size = await getFileSize(uri);
  const sizeMB = size / (1024 * 1024);

  if (sizeMB > MAX_VIDEO_SIZE_MB) {
    return {
      isValid: false,
      size,
      sizeMB,
      message: `Video too large (${sizeMB.toFixed(1)}MB). Max is ${MAX_VIDEO_SIZE_MB}MB.`,
    };
  }

  return { isValid: true, size, sizeMB };
};
