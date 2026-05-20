import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

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
          backgroundColor: "#E5E7EB",
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
            backgroundColor: "#F3F4F6",
            opacity: 0.6,
          }}
        />
      </Animated.View>
    </View>
  );
};

// ============================================
// COMMENT SCREEN SKELETON
// ============================================

const CommentScreenSkeleton: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBtn}>
          <Ionicons name="arrow-back" size={24} color="#D1D5DB" />
        </View>
        <SkeletonBlock width={100} height={16} />
        <View style={styles.headerBtn} />
      </View>

      <View style={styles.content}>
        {/* ── User Row ── */}
        <View style={styles.userRow}>
          <SkeletonBlock
            width={40}
            height={40}
            borderRadius={20}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <SkeletonBlock
              width={130}
              height={15}
              style={{ marginBottom: 4 }}
            />
            <SkeletonBlock width={80} height={12} />
          </View>
        </View>

        {/* ── Post Content ── */}
        <SkeletonBlock width="100%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="85%" height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width="55%" height={14} style={{ marginBottom: 16 }} />

        {/* ── Post Image ── */}
        <SkeletonBlock
          width="100%"
          height={300}
          borderRadius={12}
          style={{ marginBottom: 16 }}
        />

        {/* ── Stats Row ── */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="heart-outline" size={18} color="#D1D5DB" />
            <SkeletonBlock width={24} height={14} />
          </View>
          <View style={styles.stat}>
            <Ionicons name="chatbubble-outline" size={18} color="#D1D5DB" />
            <SkeletonBlock width={24} height={14} />
          </View>
          <View style={styles.stat}>
            <Ionicons name="share-outline" size={18} color="#D1D5DB" />
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── Comments Header ── */}
        <SkeletonBlock
          width={90}
          height={16}
          style={{ marginTop: 16, marginBottom: 20 }}
        />

        {/* ── Comment Items ── */}
        {[1, 2, 3, 4].map((i) => (
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
                <SkeletonBlock width={35} height={10} />
                <SkeletonBlock width={35} height={10} />
              </View>
            </View>
          </View>
        ))}

        {/* ── Nested Reply ── */}
        <View style={styles.commentRowNested}>
          <SkeletonBlock
            width={36}
            height={36}
            borderRadius={18}
            style={{ marginRight: 12 }}
          />
          <View style={{ flex: 1 }}>
            <SkeletonBlock width={80} height={12} style={{ marginBottom: 6 }} />
            <SkeletonBlock
              width="85%"
              height={12}
              style={{ marginBottom: 4 }}
            />
            <SkeletonBlock
              width="60%"
              height={12}
              style={{ marginBottom: 8 }}
            />
            <View style={{ flexDirection: "row", gap: 16 }}>
              <SkeletonBlock width={30} height={10} />
              <SkeletonBlock width={35} height={10} />
            </View>
          </View>
        </View>
      </View>

      {/* ── Comment Input ── */}
      <View style={styles.inputBar}>
        <SkeletonBlock
          width={32}
          height={32}
          borderRadius={16}
          style={{ marginRight: 10 }}
        />
        <View style={styles.inputField}>
          <SkeletonBlock width="50%" height={14} />
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerBtn: {
    width: 40,
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: "row",
    gap: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  stat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  divider: {},
  commentRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  commentRowNested: {
    flexDirection: "row",
    marginBottom: 16,
    marginLeft: 48,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  inputField: {
    flex: 1,
    height: 40,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
});

export default CommentScreenSkeleton;
