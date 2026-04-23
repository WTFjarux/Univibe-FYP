// app/hooks/useMessageScroll.ts

import { useRef, useState, useCallback } from 'react';
import { FlatList, View, findNodeHandle } from 'react-native';

export function useMessageScroll(flatListRef: React.RefObject<FlatList>) {
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messageRefs = useRef<Map<string, React.RefObject<View>>>(new Map());
  const highlightTimeoutRef = useRef<number | null>(null);

  const registerMessageRef = useCallback((messageId: string, ref: React.RefObject<View>) => {
    if (messageId && !messageId.startsWith('temp_') && ref && ref.current) {
      messageRefs.current.set(messageId, ref);
    }
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const messageRef = messageRefs.current.get(messageId);
    
    if (messageRef?.current && flatListRef.current) {
      try {
        // Get the native node handles
        const messageNode = findNodeHandle(messageRef.current);
        const listNode = findNodeHandle(flatListRef.current);
        
        if (messageNode && listNode) {
          // Use UIManager to measure layout
          const { UIManager } = require('react-native');
          
          UIManager.measureLayout(
            messageNode,
            listNode,
            () => {
              // Silent fail - measurement failed
            },
            (x: number, y: number, width: number, height: number) => {
              // Scroll to the measured position with offset
              const scrollOffset = Math.max(0, y - 80);
              
              flatListRef.current?.scrollToOffset({
                offset: scrollOffset,
                animated: true,
              });

              // Trigger highlight animation
              setHighlightedMessageId(messageId);
              
              if (highlightTimeoutRef.current) {
                clearTimeout(highlightTimeoutRef.current);
              }
              
              highlightTimeoutRef.current = setTimeout(() => {
                setHighlightedMessageId(null);
                highlightTimeoutRef.current = null;
              }, 2500);
            }
          );
        }
      } catch (error) {
        // Silent fail
      }
    }
  }, [flatListRef]);

  const clearHighlight = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightedMessageId(null);
  }, []);

  const onScroll = useCallback((event: any) => {
    // Optional: Track scroll position if needed
  }, []);

  const onLayout = useCallback((event: any) => {
    // Optional: Track FlatList layout if needed
  }, []);

  return {
    highlightedMessageId,
    registerMessageRef,
    scrollToMessage,
    clearHighlight,
    onScroll,
    onLayout,
  };
}