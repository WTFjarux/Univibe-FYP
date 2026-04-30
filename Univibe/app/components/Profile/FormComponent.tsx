import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";

// ==================== SCROLLABLE DROPDOWN ====================

export interface DropdownOption {
  id: string;
  label: string;
  value: string;
}

interface ScrollableDropdownProps {
  label: string;
  value: string;
  options: string[] | DropdownOption[];
  onSelect: (value: string) => void;
  placeholder: string;
  required?: boolean;
  icon?: React.ReactNode;
  error?: string;
}

export const ScrollableDropdown: React.FC<ScrollableDropdownProps> = ({
  label,
  value,
  options,
  onSelect,
  placeholder,
  required = false,
  icon,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getDisplayValue = () => {
    if (!value) return placeholder;

    if (options.length > 0 && typeof options[0] === "object") {
      const option = (options as DropdownOption[]).find(
        (opt) => opt.value === value,
      );
      return option ? option.label : value;
    }
    return value;
  };

  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelContainer}>
        {icon}
        <Text style={styles.label}>
          {label} {required && <Text style={styles.requiredStar}>*</Text>}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.dropdownButton, error && styles.dropdownButtonError]}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.7}
      >
        <Text
          style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}
          numberOfLines={1}
        >
          {getDisplayValue()}
        </Text>
        <Ionicons
          name={isOpen ? "chevron-up" : "chevron-down"}
          size={20}
          color="#6b7280"
          style={styles.dropdownIcon}
        />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdownList}>
          <ScrollView
            nestedScrollEnabled={true}
            showsVerticalScrollIndicator={true}
            style={styles.dropdownScrollView}
            keyboardShouldPersistTaps="handled"
          >
            {options.map((option, index) => {
              const isObject = typeof option === "object" && option !== null;
              const optionValue = isObject ? (option as any).value : option;
              const optionLabel = isObject ? (option as any).label : option;
              const isSelected = value === optionValue;

              return (
                <TouchableOpacity
                  key={isObject ? (option as any).id : `option-${index}`}
                  style={[
                    styles.dropdownItem,
                    isSelected && styles.dropdownItemSelected,
                    index === options.length - 1 && styles.dropdownItemLast,
                  ]}
                  onPress={() => {
                    onSelect(optionValue);
                    setIsOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      isSelected && styles.dropdownItemTextSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {optionLabel}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color="#4f46e5" />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

// ==================== YEAR SELECTOR ====================

interface YearSelectorProps {
  value: string;
  onSelect: (year: string) => void;
  required?: boolean;
}

const YEARS = [
  { id: "upc", label: "UPC", value: "UPC" },
  { id: "first", label: "First Year", value: "First" },
  { id: "second", label: "Second Year", value: "Second" },
  { id: "third", label: "Third Year", value: "Third" },
];

export const YearSelector: React.FC<YearSelectorProps> = ({
  value,
  onSelect,
  required = false,
}) => {
  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelContainer}>
        <MaterialIcons name="calendar-today" size={20} color="#8b5cf6" />
        <Text style={styles.label}>
          Current Year {required && <Text style={styles.requiredStar}>*</Text>}
        </Text>
      </View>
      <View style={styles.yearGrid}>
        {YEARS.map((year) => (
          <TouchableOpacity
            key={year.id}
            style={[
              styles.yearCard,
              value === year.value && styles.yearCardActive,
            ]}
            onPress={() => onSelect(year.value)}
          >
            <Text
              style={[
                styles.yearCardText,
                value === year.value && styles.yearCardTextActive,
              ]}
            >
              {year.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ==================== PRONOUNS SELECTOR ====================

interface PronounsSelectorProps {
  value: string;
  onSelect: (pronouns: string) => void;
}

const PRONOUNS = ["he/him", "she/her", "they/them"];

export const PronounsSelector: React.FC<PronounsSelectorProps> = ({
  value,
  onSelect,
}) => {
  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelContainer}>
        <MaterialIcons name="badge" size={20} color="#8b5cf6" />
        <Text style={styles.label}>Pronouns</Text>
      </View>
      <View style={styles.pronounContainer}>
        {PRONOUNS.map((pronoun) => (
          <TouchableOpacity
            key={pronoun}
            style={[
              styles.pronounButton,
              value === pronoun && styles.pronounButtonActive,
            ]}
            onPress={() => onSelect(pronoun)}
          >
            <Text
              style={[
                styles.pronounButtonText,
                value === pronoun && styles.pronounButtonTextActive,
              ]}
            >
              {pronoun}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// ==================== BIO INPUT ====================

interface BioInputProps {
  value: string;
  onChange: (text: string) => void;
  maxLength?: number;
}

export const BioInput: React.FC<BioInputProps> = ({
  value,
  onChange,
  maxLength = 200,
}) => {
  return (
    <View style={styles.inputGroup}>
      <View style={styles.labelContainer}>
        <Ionicons name="document-text-outline" size={20} color="#8b5cf6" />
        <Text style={styles.label}>Bio</Text>
      </View>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={value}
        onChangeText={onChange}
        placeholder="Tell us about yourself..."
        multiline
        numberOfLines={4}
        maxLength={maxLength}
        textAlignVertical="top"
        returnKeyType="next"
      />
      <Text style={styles.charCount}>
        {maxLength - value.length} characters remaining
      </Text>
    </View>
  );
};

// ==================== SOCIAL LINKS INPUT ====================

interface SocialLinksInputProps {
  instagram: string;
  linkedin: string;
  github: string;
  onInstagramChange: (value: string) => void;
  onLinkedinChange: (value: string) => void;
  onGithubChange: (value: string) => void;
}

export const SocialLinksInput: React.FC<SocialLinksInputProps> = ({
  instagram,
  linkedin,
  github,
  onInstagramChange,
  onLinkedinChange,
  onGithubChange,
}) => {
  return (
    <>
      <View style={styles.inputGroup}>
        <View style={styles.socialInputContainer}>
          <Ionicons name="logo-instagram" size={20} color="#8b5cf6" />
          <TextInput
            style={styles.socialInput}
            value={instagram}
            onChangeText={onInstagramChange}
            placeholder="Instagram username"
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.socialInputContainer}>
          <Ionicons name="logo-linkedin" size={20} color="#3b82f6" />
          <TextInput
            style={styles.socialInput}
            value={linkedin}
            onChangeText={onLinkedinChange}
            placeholder="LinkedIn username"
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>
      </View>

      <View style={styles.inputGroup}>
        <View style={styles.socialInputContainer}>
          <Ionicons name="logo-github" size={20} color="#000000ff" />
          <TextInput
            style={styles.socialInput}
            value={github}
            onChangeText={onGithubChange}
            placeholder="Github username"
            autoCapitalize="none"
            returnKeyType="done"
          />
        </View>
      </View>
    </>
  );
};

// ==================== STYLES ====================

const styles = StyleSheet.create({
  inputGroup: {
    marginBottom: 16,
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
    color: "#374151",
  },
  requiredStar: {
    color: "#ef4444",
    fontSize: 15,
  },
  input: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    color: "#111827",
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  charCount: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    textAlign: "right",
    marginTop: 4,
  },
  dropdownButton: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownButtonError: {
    borderColor: "#ef4444",
  },
  dropdownText: {
    fontSize: 15,
    color: "#111827",
    fontFamily: "SofiaSans-Regular",
    flex: 1,
  },
  dropdownPlaceholder: {
    color: "#9ca3af",
  },
  dropdownIcon: {
    marginLeft: 8,
  },
  dropdownList: {
    marginTop: 8,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    maxHeight: 250,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dropdownScrollView: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dropdownItemLast: {
    borderBottomWidth: 0,
  },
  dropdownItemSelected: {
    backgroundColor: "#f5f3ff",
  },
  dropdownItemText: {
    fontSize: 15,
    fontFamily: "SofiaSans-Regular",
    color: "#374151",
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: "#4f46e5",
    fontWeight: "500",
    fontFamily: "SofiaSans-Bold",
  },
  errorText: {
    fontSize: 12,
    color: "#ef4444",
    marginTop: 4,
    fontFamily: "SofiaSans-Regular",
  },
  yearGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  yearCard: {
    flex: 1,
    minWidth: "30%",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "white",
    alignItems: "center",
  },
  yearCardActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  yearCardText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    color: "#374151",
    textAlign: "center",
  },
  yearCardTextActive: {
    color: "white",

    fontFamily: "SofiaSans-Bold",
  },
  pronounContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  pronounButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "white",
  },
  pronounButtonActive: {
    backgroundColor: "#4f46e5",
    borderColor: "#4f46e5",
  },
  pronounButtonText: {
    fontSize: 14,
    fontFamily: "SofiaSans-Regular",
    color: "#374151",
  },
  pronounButtonTextActive: {
    color: "white",
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  socialInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  socialInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: "SofiaSans-Regular",
    color: "#111827",
    marginLeft: 8,
  },
});

// ==================== DEFAULT EXPORT ====================
const FormComponents = () => {
  return null;
};

export default FormComponents;
