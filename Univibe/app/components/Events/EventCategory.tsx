import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../../lib/contexts/ThemeContext";

interface EventCategoryProps {
  id: string | number;
  name: string;
  icon: string;
  count: number;
  isSelected: boolean;
  onPress: (categoryId: string) => void;
}

export default function EventCategory({
  id,
  name,
  icon,
  count,
  isSelected,
  onPress,
}: EventCategoryProps) {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      style={[
        styles.categoryCard,
        { backgroundColor: colors.card, shadowColor: colors.shadow },
      ]}
      onPress={() => onPress(id as string)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.categoryIcon,
          { backgroundColor: colors.skeleton },
          isSelected && [
            styles.categoryIconActive,
            {
              backgroundColor: isDark ? "rgba(167, 139, 250, 0.2)" : "#f3e8ff",
            },
          ],
        ]}
      >
        <Ionicons
          name={icon as any}
          size={24}
          color={isSelected ? colors.primary : colors.textSecondary}
        />
      </View>
      <Text
        style={[
          styles.categoryName,
          { color: colors.text },
          isSelected && [styles.categoryNameActive, { color: colors.primary }],
        ]}
      >
        {name}
      </Text>
      <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
        {count} events
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 120,
    height: 130,
    alignItems: "center",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryIconActive: {},
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  categoryNameActive: {},
  categoryCount: {
    fontSize: 12,
    fontFamily: "SofiaSans-Regular",
  },
});
