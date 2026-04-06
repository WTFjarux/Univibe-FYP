import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface EventCategoryProps {
  id: string | number;
  name: string;
  icon: string;
  count: number;
  isSelected: boolean;
  onPress: (categoryName: string) => void;
}

export default function EventCategory({
  id,
  name,
  icon,
  count,
  isSelected,
  onPress,
}: EventCategoryProps) {
  return (
    <TouchableOpacity
      style={styles.categoryCard}
      onPress={() => onPress(name)}
      activeOpacity={0.7}
    >
      <View
        style={[styles.categoryIcon, isSelected && styles.categoryIconActive]}
      >
        <Ionicons
          name={icon as any}
          size={24}
          color={isSelected ? "#8b5cf6" : "#6b7280"}
        />
      </View>
      <Text
        style={[styles.categoryName, isSelected && styles.categoryNameActive]}
      >
        {name}
      </Text>
      <Text style={styles.categoryCount}>{count} events</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  categoryCard: {
    backgroundColor: "white",
    padding: 16,
    borderRadius: 12,
    marginRight: 12,
    width: 120,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#f3f4f6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  categoryIconActive: {
    backgroundColor: "#f3e8ff",
  },
  categoryName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 4,
  },
  categoryNameActive: {
    color: "#8b5cf6",
  },
  categoryCount: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
});
