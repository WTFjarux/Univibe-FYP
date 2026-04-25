// hooks/chatScreen/useChatScroll.ts

import { useRef, useCallback } from "react";
import { FlatList } from "react-native";

const NEAR_BOTTOM_THRESHOLD = 150;
const AUTO_SCROLL_TIMEOUT = 3000;

export const useChatScroll = (flatListRef: React.RefObject<FlatList>) => {
  const isAutoScrollEnabledRef = useRef(true);
  const autoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentHeightRef = useRef(0);
  const isInitialScrollDoneRef = useRef(false);

  /**
   * Initial scroll to bottom - called once when messages first load
   * Since FlatList is inverted, scrollToOffset(0) scrolls to the latest messages
   */
  const initialScrollToBottom = useCallback(() => {
    if (!isInitialScrollDoneRef.current && flatListRef.current) {
      isInitialScrollDoneRef.current = true;
      // Use requestAnimationFrame for proper timing with React Native rendering
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
      });
    }
  }, [flatListRef]);

  /**
   * Handle content size changes in inverted FlatList
   * Only auto-scroll if user is at the bottom (near offset 0)
   */
  const handleContentSizeChange = useCallback(
    (_contentWidth: number, contentHeight: number) => {
      // Store content height for calculations
      contentHeightRef.current = contentHeight;

      if (isAutoScrollEnabledRef.current && isInitialScrollDoneRef.current) {
        // In inverted FlatList, offset 0 is the bottom
        // We use animated: true for smooth scrolling when new messages arrive
        requestAnimationFrame(() => {
          flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
        });
      }
    },
    [flatListRef],
  );

  /**
   * Handle layout - used for initial positioning
   */
  const handleLayout = useCallback(() => {
    if (!isInitialScrollDoneRef.current && flatListRef.current) {
      isInitialScrollDoneRef.current = true;
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [flatListRef]);

  /**
   * Unified scroll handler for inverted FlatList
   * In inverted list: offset 0 = bottom, max offset = top
   */
  const handleScroll = useCallback((event: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

    // In inverted FlatList, distance from bottom is the contentOffset.y
    // offset 0 means we're at the bottom (latest messages)
    const distanceFromBottom = contentOffset.y;

    const isNearBottom = distanceFromBottom < NEAR_BOTTOM_THRESHOLD;

    // Clear any existing timer
    if (autoScrollTimerRef.current) {
      clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }

    if (!isNearBottom) {
      // User scrolled away from bottom - disable auto-scroll temporarily
      isAutoScrollEnabledRef.current = false;

      // Re-enable auto-scroll after timeout
      autoScrollTimerRef.current = setTimeout(() => {
        isAutoScrollEnabledRef.current = true;
      }, AUTO_SCROLL_TIMEOUT);
    } else {
      // User is near bottom - enable auto-scroll
      isAutoScrollEnabledRef.current = true;
    }
  }, []);

  /**
   * Manually scroll to a message
   * Used for reply navigation and message highlighting
   */
  const scrollToMessage = useCallback(
    (messageIndex: number) => {
      if (flatListRef.current) {
        // Temporarily disable auto-scroll
        isAutoScrollEnabledRef.current = false;

        flatListRef.current.scrollToIndex({
          index: messageIndex,
          animated: true,
          viewPosition: 0.5,
        });

        // Re-enable auto-scroll after timeout
        if (autoScrollTimerRef.current) {
          clearTimeout(autoScrollTimerRef.current);
        }
        autoScrollTimerRef.current = setTimeout(() => {
          isAutoScrollEnabledRef.current = true;
        }, AUTO_SCROLL_TIMEOUT);
      }
    },
    [flatListRef],
  );

  /**
   * Force enable auto-scroll (used after sending a message)
   */
  const enableAutoScroll = useCallback(() => {
    isAutoScrollEnabledRef.current = true;
    if (autoScrollTimerRef.current) {
      clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (autoScrollTimerRef.current) {
      clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  return {
    scrollToMessage,
    initialScrollToBottom,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
    enableAutoScroll,
    cleanup,
    isAutoScrollEnabledRef,
  };
};
