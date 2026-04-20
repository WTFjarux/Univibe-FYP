import React from "react";
import { View, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export const SearchBar = ({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (text: string) => void;
}) => (
  <View style={styles.searchContainer}>
    <Ionicons name="search-outline" size={20} color="#999" />
    <TextInput
      style={styles.searchInput}
      placeholder="Search conversations..."
      value={value}
      onChangeText={onChangeText}
      placeholderTextColor="#999"
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChangeText("")}>
        <Ionicons name="close-circle" size={20} color="#999" />
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 40,
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16 },
});
