import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Animated,
  Dimensions,
} from "react-native";
import { useTheme } from "@/lib/contexts/ThemeContext";

const { width } = Dimensions.get("window");

const HomeScreenSkeleton = () => {
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerValue]);

  const opacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View
      style={[styles.skeletonContainer, { backgroundColor: colors.background }]}
    >
      <View style={styles.skeletonHeader}>
        <Animated.View
          style={[
            styles.skeletonIcon,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonLogo,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonIcon,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
      </View>
      <View style={styles.skeletonSection}>
        <View style={styles.skeletonQuickActions}>
          {[...Array(4)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.skeletonActionBtn,
                { opacity, backgroundColor: colors.skeleton },
              ]}
            />
          ))}
        </View>
      </View>
      <View style={styles.skeletonSection}>
        <Animated.View
          style={[
            styles.skeletonTitle,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.skeletonStoriesContainer}
        >
          {[...Array(6)].map((_, i) => (
            <View key={i} style={styles.skeletonStoryCard}>
              <Animated.View
                style={[
                  styles.skeletonStoryRing,
                  {
                    opacity,
                    backgroundColor: colors.skeleton,
                    borderColor: colors.skeletonHighlight,
                  },
                ]}
              >
                <Animated.View
                  style={[
                    styles.skeletonStoryAvatar,
                    { opacity, backgroundColor: colors.skeletonHighlight },
                  ]}
                />
              </Animated.View>
              <Animated.View
                style={[
                  styles.skeletonStoryName,
                  { opacity, backgroundColor: colors.skeleton },
                ]}
              />
            </View>
          ))}
        </ScrollView>
      </View>
      <View style={styles.skeletonSection}>
        <Animated.View
          style={[
            styles.skeletonTitle,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[...Array(4)].map((_, i) => (
            <Animated.View
              key={i}
              style={[
                styles.skeletonCommunityCard,
                { opacity, backgroundColor: colors.skeleton },
              ]}
            />
          ))}
        </ScrollView>
      </View>
      <View style={styles.skeletonSection}>
        <Animated.View
          style={[
            styles.skeletonTitle,
            { opacity, backgroundColor: colors.skeleton },
          ]}
        />
        {[...Array(3)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.skeletonEventCard,
              { opacity, backgroundColor: colors.card },
            ]}
          >
            <Animated.View
              style={[
                styles.skeletonEventDate,
                { opacity, backgroundColor: colors.skeleton },
              ]}
            />
            <View style={styles.skeletonEventDetails}>
              <Animated.View
                style={[
                  styles.skeletonEventName,
                  { opacity, backgroundColor: colors.skeleton },
                ]}
              />
              <Animated.View
                style={[
                  styles.skeletonEventMeta,
                  { opacity, backgroundColor: colors.skeleton },
                ]}
              />
            </View>
          </Animated.View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeletonContainer: { flex: 1, backgroundColor: "#f8fafc" },
  skeletonHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  skeletonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
  },
  skeletonLogo: {
    width: 120,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  skeletonSection: { paddingHorizontal: 20, marginTop: 24 },
  skeletonQuickActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  skeletonActionBtn: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  skeletonTitle: {
    width: 150,
    height: 20,
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    marginBottom: 16,
  },
  skeletonStoriesContainer: { flexDirection: "row" },
  skeletonStoryCard: { alignItems: "center", marginRight: 16, width: 90 },
  skeletonStoryRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#f3f4f6",
    marginBottom: 8,
    borderWidth: 3,
    borderColor: "#e5e7eb",
  },
  skeletonStoryAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#e5e7eb",
    margin: 2,
  },
  skeletonStoryName: {
    width: 70,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
  skeletonCommunityCard: {
    width: 140,
    height: 130,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    marginRight: 12,
  },
  skeletonEventCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    backgroundColor: "#f9fafb",
  },
  skeletonEventDate: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    marginRight: 14,
  },
  skeletonEventDetails: { flex: 1, gap: 8 },
  skeletonEventName: {
    width: "70%",
    height: 16,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
  skeletonEventMeta: {
    width: "90%",
    height: 12,
    borderRadius: 4,
    backgroundColor: "#f3f4f6",
  },
});

export default HomeScreenSkeleton;
