// app/components/Feed/FilterTabs.tsx
import React from "react";
import { ScrollView, TouchableOpacity, Text, StyleSheet } from "react-native";

interface FilterTab {
  id: string;
  label: string;
}

interface FilterTabsProps {
  filters: FilterTab[];
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

const FilterTabs: React.FC<FilterTabsProps> = ({
  filters,
  activeFilter,
  onFilterChange,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filtersContainer}
      contentContainerStyle={styles.filtersContent}
    >
      {filters.map((filter) => (
        <TouchableOpacity
          key={filter.id}
          style={[
            styles.filterButton,
            activeFilter === filter.id && styles.filterButtonActive,
          ]}
          onPress={() => onFilterChange(filter.id)}
        >
          <Text
            style={[
              styles.filterText,
              activeFilter === filter.id && styles.filterTextActive,
            ]}
          >
            {filter.label}
          </Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  filtersContainer: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexGrow: 0,
  },
  filtersContent: {
    paddingRight: 20,
    paddingVertical: 4,
    alignItems: "center",
    gap: 12,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "white",
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    minHeight: 34,
    justifyContent: "center",
  },
  filterButtonActive: {
    backgroundColor: "#8b5cf6",
    borderColor: "#8b5cf6",
  },
  filterText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
    fontFamily: "SofiaSans-Bold",
    lineHeight: 20,
  },
  filterTextActive: {
    color: "white",
  },
});

export default FilterTabs;
