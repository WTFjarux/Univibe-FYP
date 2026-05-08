import React, { memo, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { StoryGroup } from "../../../lib/services/storyApi";

const { width } = Dimensions.get("window");

interface StoryCarouselProps {
  storyGroups: StoryGroup[];
  currentGroupIndex: number;
  onGroupChange: (index: number) => void;
  children: React.ReactNode;
}

const StoryCarousel = memo(
  ({
    storyGroups,
    currentGroupIndex,
    onGroupChange,
    children,
  }: StoryCarouselProps) => {
    const scrollRef = useRef<any>(null);
    const scrollX = useSharedValue(0);
    const isManualScroll = useSharedValue(false);

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
        if (newIndex !== currentGroupIndex) {
          isManualScroll.value = true;
          runOnJS(onGroupChange)(newIndex);
          setTimeout(() => {
            isManualScroll.value = false;
          }, 500);
        }
      },
    });

    return (
      <View style={styles.container}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          decelerationRate="fast"
          bounces={false}
        >
          {storyGroups.map((group, index) => (
            <View key={group.userId} style={styles.page}>
              {index >= currentGroupIndex - 1 &&
                index <= currentGroupIndex + 1 && <>{children}</>}
            </View>
          ))}
        </Animated.ScrollView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    width,
    flex: 1,
  },
});

export default StoryCarousel;
