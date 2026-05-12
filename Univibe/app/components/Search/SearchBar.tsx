import React, { useRef, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Text,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  loading?: boolean;
  onClear?: () => void;
}

/**
 * Animated search bar component with clear button and loading indicator.
 *
 * Features:
 * - Animated placeholder
 * - Clear button (appears when text is entered)
 * - Loading spinner (replaces search icon when searching)
 * - Submit on keyboard return
 */
export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  onSubmit,
  placeholder = "Search Univibes...",
  autoFocus = false,
  loading = false,
  onClear,
}) => {
  const inputRef = useRef<TextInput>(null);
  const clearButtonOpacity = useRef(new Animated.Value(0)).current;

  // Animate clear button visibility
  useEffect(() => {
    Animated.timing(clearButtonOpacity, {
      toValue: value.length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [value.length]);

  const handleClear = () => {
    onChangeText("");
    if (onClear) onClear();
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputWrapper}>
        {/* Search Icon / Loading Spinner */}
        <View style={styles.iconContainer}>
          {loading ? (
            <Ionicons name="hourglass-outline" size={20} color="#8b5cf6" />
          ) : (
            <Ionicons name="search" size={20} color="#6b7280" />
          )}
        </View>

        {/* Text Input */}
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
        />

        {/* Clear Button (Animated) */}
        {value.length > 0 && (
          <Animated.View
            style={[
              styles.clearButtonContainer,
              { opacity: clearButtonOpacity },
            ]}
          >
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearButton}
            >
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* Cancel Button (optional, shown when focused) */}
      {value.length > 0 && (
        <TouchableOpacity onPress={handleClear} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  iconContainer: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    fontFamily: "SofiaSans-Regular",
    paddingVertical: 0, // Remove default padding on Android
  },
  clearButtonContainer: {
    marginLeft: 4,
  },
  clearButton: {
    padding: 4,
  },
  cancelButton: {
    paddingHorizontal: 4,
  },
  cancelText: {
    fontSize: 15,
    color: "#8b5cf6",
    fontFamily: "SofiaSans-Medium",
  },
});

export default SearchBar