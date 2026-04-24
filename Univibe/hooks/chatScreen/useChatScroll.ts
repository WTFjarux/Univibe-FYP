// hooks/chatScreen/useChatScroll.ts

import { useRef, useCallback } from 'react';
import { FlatList, LayoutChangeEvent, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';

const AUTO_SCROLL_TIMEOUT = 3000;
const SCROLL_TO_MESSAGE_TIMEOUT = 5000;

export const useChatScroll = (flatListRef: React.RefObject<FlatList>) => {
  const isInitialLoadRef = useRef(true);
  const autoScrollEnabledRef = useRef(true);
  const isManualScrollRef = useRef(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const manualScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToEnd = useCallback((animated = true) => {
    flatListRef.current?.scrollToEnd({ animated });
  }, [flatListRef]);

  const handleContentSizeChange = useCallback(() => {
    if (autoScrollEnabledRef.current && !isManualScrollRef.current && !isInitialLoadRef.current) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [flatListRef]);

  const handleLayout = useCallback((_event: LayoutChangeEvent) => {
    if (isInitialLoadRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
        isInitialLoadRef.current = false;
        autoScrollEnabledRef.current = true;
      }, 100);
    }
  }, [flatListRef]);

  // ✅ FIX: Proper return type matching NativeSyntheticEvent<NativeScrollEvent>
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (isManualScrollRef.current) {
      isManualScrollRef.current = false;
      if (manualScrollTimeoutRef.current) clearTimeout(manualScrollTimeoutRef.current);
    }

    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const isNearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;

    if (autoScrollEnabledRef.current) {
      autoScrollEnabledRef.current = false;
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);

      scrollTimeoutRef.current = setTimeout(() => {
        if (isNearBottom) {
          autoScrollEnabledRef.current = true;
        } else {
          scrollTimeoutRef.current = setTimeout(() => {
            autoScrollEnabledRef.current = true;
          }, 5000);
        }
      }, AUTO_SCROLL_TIMEOUT);
    }
  }, []);

  const setManualScroll = useCallback(() => {
    isManualScrollRef.current = true;
    autoScrollEnabledRef.current = false;
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (manualScrollTimeoutRef.current) clearTimeout(manualScrollTimeoutRef.current);
  }, []);

  const resetManualScroll = useCallback(() => {
    setTimeout(() => {
      isManualScrollRef.current = false;
    }, 1000);

    manualScrollTimeoutRef.current = setTimeout(() => {
      autoScrollEnabledRef.current = true;
    }, SCROLL_TO_MESSAGE_TIMEOUT);
  }, []);

  const enableAutoScroll = useCallback(() => {
    autoScrollEnabledRef.current = true;
  }, []);

  const cleanup = useCallback(() => {
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    if (manualScrollTimeoutRef.current) clearTimeout(manualScrollTimeoutRef.current);
  }, []);

  return {
    scrollToEnd,
    handleContentSizeChange,
    handleLayout,
    handleScroll,
    setManualScroll,
    resetManualScroll,
    enableAutoScroll,
    cleanup,
  };
};