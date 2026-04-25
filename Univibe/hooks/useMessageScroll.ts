// app/hooks/useMessageScroll.ts

import { useRef, useState, useCallback } from "react";
import { FlatList, View, findNodeHandle, UIManager } from "react-native";

export function useMessageScroll(flatListRef: React.RefObject<FlatList>) {
  const [highlightedMessageId, setHighlightedMessageId] = useState<
    string | null
  >(null);
  const messageRefs = useRef<Map<string, React.RefObject<View>>>(new Map());
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const registerMessageRef = useCallback(
    (messageId: string, ref: React.RefObject<View>) => {
      if (messageId && !messageId.startsWith("temp_") && ref?.current) {
        messageRefs.current.set(messageId, ref);
      }
    },
    [],
  );

  const scrollToMessage = useCallback(
    (messageId: string) => {
      const messageRef = messageRefs.current.get(messageId);

      if (messageRef?.current && flatListRef.current) {
        try {
          const messageNode = findNodeHandle(messageRef.current);
          const listNode = findNodeHandle(flatListRef.current);

          if (messageNode && listNode) {
            UIManager.measureLayout(
              messageNode,
              listNode,
              () => {
                // Measurement failed silently
              },
              (x: number, y: number, width: number, height: number) => {
                // Scroll to message with top offset for visibility
                const scrollOffset = Math.max(0, y - 80);

                flatListRef.current?.scrollToOffset({
                  offset: scrollOffset,
                  animated: true,
                });

                // Trigger highlight animation
                setHighlightedMessageId(messageId);

                // Clear previous timeout
                if (highlightTimeoutRef.current) {
                  clearTimeout(highlightTimeoutRef.current);
                }

                // Auto-remove highlight after 2.5 seconds
                highlightTimeoutRef.current = setTimeout(() => {
                  setHighlightedMessageId(null);
                  highlightTimeoutRef.current = null;
                }, 2500);
              },
            );
          }
        } catch (error) {
          console.warn("Failed to scroll to message:", error);
        }
      }
    },
    [flatListRef],
  );

  const clearHighlight = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightedMessageId(null);
  }, []);

  return {
    highlightedMessageId,
    registerMessageRef,
    scrollToMessage,
    clearHighlight,
  };
}
