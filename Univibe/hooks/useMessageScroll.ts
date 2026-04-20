// app/hooks/useMessageScroll.ts
import { useRef, useState, useCallback } from 'react';
import { FlatList } from 'react-native';

interface MessagePosition {
  messageId: string;
  yOffset: number;
}

export function useMessageScroll(flatListRef: React.RefObject<FlatList>) {
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messagePositions = useRef<Map<string, number>>(new Map());
  const highlightTimeoutRef = useRef<number | null>(null);

  const registerMessagePosition = useCallback((messageId: string, yOffset: number) => {
    if (messageId && !messageId.startsWith('temp_')) {
      messagePositions.current.set(messageId, yOffset);
    }
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const yOffset = messagePositions.current.get(messageId);
    
    if (yOffset !== undefined && flatListRef.current) {
      // Scroll to message with offset for visibility
      flatListRef.current.scrollToOffset({
        offset: Math.max(0, yOffset - 100),
        animated: true,
      });

      // Trigger highlight animation
      setHighlightedMessageId(messageId);
      
      // Clear previous timeout
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      
      // Remove highlight after animation
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedMessageId(null);
        highlightTimeoutRef.current = null;
      }, 2000);
    }
  }, []);

  const clearHighlight = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightedMessageId(null);
  }, []);

  return {
    highlightedMessageId,
    registerMessagePosition,
    scrollToMessage,
    clearHighlight,
  };
}