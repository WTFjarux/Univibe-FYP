// app/components/Search/CommunitySearchResult.tsx

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { CommunitySearchResult as CommunitySearchResultType } from "../../../lib/types/search";
import { getFullImageUrl } from "../../../lib/services/communityService";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = SCREEN_WIDTH - 32; // 16px padding on each side
const COVER_HEIGHT = CARD_WIDTH * (9 / 16); // 16:9 aspect ratio

interface Props {
  community: CommunitySearchResultType;
}

export const CommunitySearchResult: React.FC<Props> = ({ community }) => {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const isMember = community.isMember || false;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: isDark ? "#1e293b" : "#ffffff" }]}
      onPress={() =>
        router.push(
          `/screens/CommunityScreen?communityId=${community._id}` as any,
        )
      }
      activeOpacity={0.7}
    >
      {/* Cover Image - 16:9 aspect ratio */}
      <View style={styles.coverContainer}>
        {community.coverImage ? (
          <Image
            source={{ uri: getFullImageUrl(community.coverImage) }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.coverPlaceholder,
              { backgroundColor: colors.primary + "20" },
            ]}
          >
            <Ionicons name="people" size={36} color={colors.primary} />
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        {/* Name & Type Badge */}
        <View style={styles.cardHeader}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {community.name}
          </Text>
          <View
            style={[
              styles.typeBadge,
              { backgroundColor: colors.primary + "15" },
            ]}
          >
            <Text style={[styles.typeBadgeText, { color: colors.primary }]}>
              Community
            </Text>
          </View>
        </View>

        {/* Description */}
        {community.description ? (
          <Text
            style={[styles.description, { color: colors.textSecondary }]}
            numberOfLines={2}
          >
            {community.description}
          </Text>
        ) : null}

        {/* Footer */}
        <View style={styles.cardFooter}>
          <View style={styles.memberCount}>
            <Ionicons
              name="people-outline"
              size={14}
              color={colors.textSecondary}
            />
            <Text
              style={[styles.memberCountText, { color: colors.textSecondary }]}
            >
              {community.memberCount}{" "}
              {community.memberCount === 1 ? "member" : "members"}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: isMember
                  ? colors.primary + "15"
                  : colors.primary,
              },
            ]}
          >
            <Ionicons
              name={isMember ? "checkmark-circle" : "add-circle-outline"}
              size={14}
              color={isMember ? colors.primary : "#ffffff"}
            />
            <Text
              style={[
                styles.statusText,
                { color: isMember ? colors.primary : "#ffffff" },
              ]}
            >
              {isMember ? "Joined" : "Join"}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 6,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  coverContainer: {
    width: "100%",
    aspectRatio: 16 / 9, // ✅ Matches crop ratio from image picker
    overflow: "hidden",
  },
  coverImage: {
    width: "100%",
    height: "100%", // ✅ Fills the aspect ratio container
  },
  coverPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    padding: 12,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontFamily: "SofiaSans-Bold",
    flex: 1,
    marginRight: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontFamily: "SofiaSans-SemiBold",
  },
  description: {
    fontSize: 13,
    fontFamily: "SofiaSans-Regular",
    lineHeight: 18,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  memberCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  memberCountText: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontFamily: "SofiaSans-Bold",
  },
});

export default CommunitySearchResult;
