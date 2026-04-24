import { useRef } from "react";
import { Animated } from "react-native";

export const useChatItemAnimations = () => {
  const itemScaleAnim = useRef(new Animated.Value(1)).current;
  const itemTranslateYAnim = useRef(new Animated.Value(0)).current;
  const highlightAnimRef = useRef(new Animated.Value(0));
  const highlightedRoomIdRef = useRef<string | null>(null);

  const animateItemPop = () => {
    Animated.parallel([
      Animated.spring(itemScaleAnim, {
        toValue: 1.03,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(itemTranslateYAnim, {
        toValue: -6,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const resetItemAnimation = () => {
    Animated.parallel([
      Animated.spring(itemScaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(itemTranslateYAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const triggerHighlight = (roomId: string) => {
    highlightedRoomIdRef.current = roomId;
    highlightAnimRef.current.setValue(1);
    Animated.timing(highlightAnimRef.current, {
      toValue: 0,
      duration: 500,
      useNativeDriver: false,
    }).start(() => {
      highlightedRoomIdRef.current = null;
    });
  };

  return {
    itemScaleAnim,
    itemTranslateYAnim,
    highlightAnimRef,
    highlightedRoomIdRef,
    animateItemPop,
    resetItemAnimation,
    triggerHighlight,
  };
};