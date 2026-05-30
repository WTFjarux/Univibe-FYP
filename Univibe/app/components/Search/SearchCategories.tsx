import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useTheme } from "../../../lib/contexts/ThemeContext";
import { SearchCategory } from "../../../lib/types/search";

// Enable LayoutAnimation on Android
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface SearchCategoriesProps {
  activeCategory: SearchCategory;
  onCategoryChange: (category: SearchCategory) => void;
  resultCounts?: {
    users: number;
    posts: number;
    events: number;
    communities: number;
  };
}

interface CategoryItem {
  id: SearchCategory;
  label: string;
  icon: string;
}

const categories: CategoryItem[] = [
  { id: "all", label: "All", icon: "apps-outline" },
  { id: "users", label: "People", icon: "people-outline" },
  { id: "posts", label: "Posts", icon: "chatbubbles-outline" },
  { id: "events", label: "Events", icon: "calendar-outline" },
  { id: "communities", label: "Communities", icon: "people-outline" },
];

/**
 * Horizontal scrollable category tabs for search filtering.
 *
 * Features:
 * - Animated tab transitions
 * - Optional result counts per category
 * - Active tab indicator
 */
export const SearchCategories: React.FC<SearchCategoriesProps> = ({
  activeCategory,
  onCategoryChange,
  resultCounts,
}) => {
  const { colors } = useTheme();

  const handleCategoryPress = (category: SearchCategory) => {
    if (category === activeCategory) return;

    // Animate the transition
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onCategoryChange(category);
  };

  return (
    <View style={[styles.container, { borderBottomColor: colors.background }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {categories.map((category) => {
          const isActive = activeCategory === category.id;
          const count = resultCounts
            ? (resultCounts as any)[category.id]
            : undefined;

          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.tab,
                { backgroundColor: colors.skeleton },
                isActive && [
                  styles.activeTab,
                  { backgroundColor: colors.primary },
                ],
              ]}
              onPress={() => handleCategoryPress(category.id)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: colors.textSecondary },
                  isActive && styles.activeTabText,
                ]}
              >
                {category.label}
              </Text>

              {/* Show count badge if results exist */}
              {count !== undefined && count > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    { backgroundColor: colors.skeletonHighlight },
                    isActive && styles.activeCountBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.countText,
                      { color: colors.textSecondary },
                      isActive && styles.activeCountText,
                    ]}
                  >
                    {count > 99 ? "99+" : count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    gap: 6,
  },
  activeTab: {
    backgroundColor: "#8b5cf6",
  },
  tabText: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Medium",
  },
  activeTabText: {
    color: "#ffffff",
    fontFamily: "SofiaSans-Bold",
  },
  countBadge: {
    backgroundColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  activeCountBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  countText: {
    fontSize: 11,
    color: "#6b7280",
    fontFamily: "SofiaSans-Medium",
  },
  activeCountText: {
    color: "#ffffff",
    fontFamily: "SofiaSans-Bold",
  },
});

export default SearchCategories;
