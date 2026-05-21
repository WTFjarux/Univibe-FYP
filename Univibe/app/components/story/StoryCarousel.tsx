// app/components/story/StoryCarousel.tsx

import React, { memo, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, Dimensions, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  runOnJS,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { StoryGroup } from "../../../lib/services/storyApi";

const { width } = Dimensions.get("window");

interface StoryCarouselProps {
  storyGroups: StoryGroup[];
  currentGroupIndex: number;
  onGroupChange: (index: number) => void;
  children: React.ReactNode;
}

const AnimatedScrollView = Animated.ScrollView;

const StoryCarousel = memo(
  ({
    storyGroups,
    currentGroupIndex,
    onGroupChange,
    children,
  }: StoryCarouselProps) => {
    const scrollRef = useRef<Animated.ScrollView>(null);
    const scrollX = useSharedValue(0);
    const isManualScroll = useSharedValue(false);
    const currentIndexRef = useRef(currentGroupIndex);

    // Update ref when index changes
    useEffect(() => {
      currentIndexRef.current = currentGroupIndex;
    }, [currentGroupIndex]);

    // Scroll to current group when index changes programmatically
    useEffect(() => {
      if (!isManualScroll.value && scrollRef.current) {
        scrollRef.current.scrollTo({
          x: currentGroupIndex * width,
          animated: true,
        });
      }
    }, [currentGroupIndex]);

    const scrollHandler = useAnimatedScrollHandler({
      onScroll: (event) => {
        scrollX.value = event.contentOffset.x;
      },
      onMomentumEnd: (event) => {
        const newIndex = Math.round(event.contentOffset.x / width);
        if (newIndex !== currentIndexRef.current) {
          isManualScroll.value = true;
          runOnJS(onGroupChange)(newIndex);
          // Reset manual flag after animation completes
          setTimeout(() => {
            isManualScroll.value = false;
          }, 600);
        }
      },
    });

    // Convert children to array for individual page rendering
    const childrenArray = React.Children.toArray(children);

    return (
      <View style={styles.container}>
        <AnimatedScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          decelerationRate="fast"
          bounces={false}
          snapToInterval={width}
          snapToAlignment="center"
          disableIntervalMomentum={false}
        >
          {storyGroups.map((group, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width,
            ];

            // eslint-disable-next-line react-hooks/rules-of-hooks
            const animatedStyle = useAnimatedStyle(() => {
              const opacity = interpolate(
                scrollX.value,
                inputRange,
                [0.85, 1, 0.85],
                Extrapolate.CLAMP,
              );

              const scale = interpolate(
                scrollX.value,
                inputRange,
                [0.95, 1, 0.95],
                Extrapolate.CLAMP,
              );

              return {
                opacity,
                transform: [{ scale }],
              };
            });

            return (
              <Animated.View
                key={group.userId}
                style={[styles.page, animatedStyle]}
              >
                {/* Render the specific child for this index */}
                {childrenArray[index] || null}
              </Animated.View>
            );
          })}
        </AnimatedScrollView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  page: {
    width,
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
});

export default StoryCarousel;
