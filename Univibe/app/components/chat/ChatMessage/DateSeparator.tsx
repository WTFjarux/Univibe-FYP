// app/components/chat/ChatMessage/DateSeparator.tsx

import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface DateSeparatorProps {
  date: string;
}

const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>{date}</Text>
      </View>
      <View style={styles.line} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E5EA",
  },
  dateContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#F2F2F7",
    borderRadius: 16,
    marginHorizontal: 8,
  },
  dateText: {
    fontSize: 12,
    color: "#8E8E93",
    fontWeight: "500",
    fontFamily: "SofiaSans-Medium",
  },
});

export default DateSeparator;
