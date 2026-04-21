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
      console.log(`Registered ref for message: ${messageId}`);
    }
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const messageRef = messageRefs.current.get(messageId);
    
    console.log(`Scrolling to message: ${messageId}`);
    
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
            (error: any) => {
              console.error(`Failed to measure message ${messageId}:`, error);
            },
            (x: number, y: number, width: number, height: number) => {
              console.log(`Message position measured: y=${y}, height=${height}`);
              
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
        } else {
          console.warn(`Could not get native nodes for message ${messageId}`);
        }
      } catch (error) {
        console.error(`Error measuring message ${messageId}:`, error);
      }
    } else {
      console.warn(`Message ref not found for ID: ${messageId}`);
      console.log('Available refs:', Array.from(messageRefs.current.keys()));
    }
  }, []);

  const clearHighlight = useCallback(() => {
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }
    setHighlightedMessageId(null);
  }, []);

  const onScroll = useCallback((event: any) => {
    // Optional: Track scroll position for debugging
    // const yOffset = event.nativeEvent.contentOffset.y;
  }, []);

  const onLayout = useCallback((event: any) => {
    // Optional: Track FlatList layout
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