// hooks/usePopAnimation.ts
import { useRef, useCallback } from 'react';
import { Animated } from 'react-native';

interface PopAnimationConfig {
  scaleFrom?: number;
  scaleTo?: number;
  opacityFrom?: number;
  opacityTo?: number;
  translateYFrom?: number;
  translateYTo?: number;
  duration?: number;
  damping?: number;
  stiffness?: number;
}

export const usePopAnimation = (config: PopAnimationConfig = {}) => {
  const {
    scaleFrom = 0.8,
    scaleTo = 1,
    opacityFrom = 0,
    opacityTo = 1,
    translateYFrom = 20,
    translateYTo = 0,
    damping = 12,
    stiffness = 100,
  } = config;

  const scaleAnim = useRef(new Animated.Value(scaleFrom)).current;
  const opacityAnim = useRef(new Animated.Value(opacityFrom)).current;
  const translateYAnim = useRef(new Animated.Value(translateYFrom)).current;

  const animateIn = useCallback(() => {
    return Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleTo,
        damping,
        stiffness,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: opacityTo,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: translateYTo,
        damping,
        stiffness,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, translateYAnim, scaleTo, opacityTo, translateYTo, damping, stiffness]);

  const animateOut = useCallback(() => {
    return Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: scaleFrom,
        damping,
        stiffness,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: opacityFrom,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(translateYAnim, {
        toValue: translateYFrom,
        damping,
        stiffness,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim, translateYAnim, scaleFrom, opacityFrom, translateYFrom, damping, stiffness]);

  const reset = useCallback(() => {
    scaleAnim.setValue(scaleFrom);
    opacityAnim.setValue(opacityFrom);
    translateYAnim.setValue(translateYFrom);
  }, [scaleAnim, opacityAnim, translateYAnim, scaleFrom, opacityFrom, translateYFrom]);

  return {
    scaleAnim,
    opacityAnim,
    translateYAnim,
    animateIn,
    animateOut,
    reset,
  };
};