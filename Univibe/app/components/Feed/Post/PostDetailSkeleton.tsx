import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/lib/contexts/ThemeContext";

const { width: screenWidth } = Dimensions.get("window");

// ============================================
// SHIMMER BLOCK
// ============================================

interface SkeletonBlockProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

const SkeletonBlock: React.FC<SkeletonBlockProps> = ({
  width,
  height,
  borderRadius = 8,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const { colors } = useTheme();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: colors.skeleton,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
          transform: [{ translateX }],
        }}
      >
        <View
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: colors.skeletonHighlight,
            opacity: 0.6,
          }}
        />
      </Animated.View>
    </View>
  );
};

// ============================================
// POST DETAIL SKELETON
// ============================================

const PostDetailSkeleton: React.FC = () => {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerPlaceholder} />
        <Text style={[styles.headerTitle, { color: colors.text }]}>Post</Text>
        <View style={styles.headerPlaceholder} />
      </View>

      <View style={styles.content}>
        {/* User Row */}
        <View style={styles.userRow}>
          <SkeletonBlock
            width={44}
            height={44}
            borderRadius={22}
            style={{ marginRight: 12 }}
          />
          <View>
            <SkeletonBlock
              width={120}
              height={14}
              style={{ marginBottom: 6 }}
            />
            <SkeletonBlock width={80} height={12} />
          </View>
        </View>

        {/* Content lines */}
        <SkeletonBlock width="100%" height={14} style={{ marginBottom: 10 }} />
        <SkeletonBlock width="85%" height={14} style={{ marginBottom: 10 }} />
        <SkeletonBlock width="55%" height={14} style={{ marginBottom: 20 }} />

        {/* Post image placeholder */}
        <SkeletonBlock
          width="100%"
          height={300}
          borderRadius={12}
          style={{ marginBottom: 20 }}
        />

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          <SkeletonBlock width={55} height={20} />
          <SkeletonBlock width={55} height={20} />
          <SkeletonBlock width={35} height={20} />
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Comments section */}
        <SkeletonBlock
          width={90}
          height={16}
          style={{ marginBottom: 20, marginTop: 16 }}
        />

        {/* Comment items */}
        {[1, 2, 3].map((i) => (
          <View key={i} style={styles.commentRow}>
            <SkeletonBlock
              width={36}
              height={36}
              borderRadius={18}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <SkeletonBlock
                width={100}
                height={12}
                style={{ marginBottom: 6 }}
              />
              <SkeletonBlock
                width="90%"
                height={12}
                style={{ marginBottom: 4 }}
              />
              <SkeletonBlock
                width="70%"
                height={12}
                style={{ marginBottom: 8 }}
              />
              <View style={{ flexDirection: "row", gap: 16 }}>
                <SkeletonBlock width={40} height={10} />
                <SkeletonBlock width={40} height={10} />
              </View>
            </View>
          </View>
        ))}

        {/* Comment input placeholder */}
        <View style={[styles.inputSkeleton, { borderTopColor: colors.border }]}>
          <SkeletonBlock
            width={32}
            height={32}
            borderRadius={16}
            style={{ marginRight: 10 }}
          />
          <SkeletonBlock width="70%" height={32} borderRadius={16} />
        </View>
      </View>
    </SafeAreaView>
  );
};

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerPlaceholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    color: "#111827",
  },
  content: {
    padding: 16,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: "#f3f4f6",
    marginTop: 12,
  },
  commentRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  inputSkeleton: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    marginTop: 8,
  },
});

export default PostDetailSkeleton;
