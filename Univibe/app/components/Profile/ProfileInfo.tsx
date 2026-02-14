import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ProfileInfoProps {
  profile: {
    major: string;
    year: string;
    graduationYear: string;
    pronouns: string;
    universityEmail: string;
    socialLinks?: {
      instagram?: string;
      linkedin?: string;
      github?: string;
    };
  };
  user: {
    email: string;
  };
}

// Update the InfoItemType
type InfoItemType = {
  key: string;
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  isLink?: boolean;
  linkUrl?: string;
};

export default function ProfileInfo({ profile, user }: ProfileInfoProps) {
  // Create base info items
  const infoItems: InfoItemType[] = [
    {
      key: "major",
      label: "Major",
      value: profile.major || "Not specified",
      icon: "school-outline",
    },
    {
      key: "year",
      label: "Year",
      value: `${profile.year || "Not specified"} • Class of ${
        profile.graduationYear || "Not specified"
      }`,
      icon: "calendar-outline",
    },
    {
      key: "email",
      label: "University Email",
      value: profile.universityEmail || user.email || "Not specified",
      icon: "mail-outline",
    },
  ];

  // Add pronouns if available
  if (profile.pronouns) {
    infoItems.push({
      key: "pronouns",
      label: "Pronouns",
      value: profile.pronouns,
      icon: "person-outline",
    });
  }

  // Add social links if available
  if (profile.socialLinks) {
    if (profile.socialLinks.instagram) {
      infoItems.push({
        key: "instagram",
        label: "Instagram",
        value: `@${profile.socialLinks.instagram}`,
        icon: "logo-instagram",
        isLink: true,
        linkUrl: `https://instagram.com/${profile.socialLinks.instagram}`,
      });
    }

    if (profile.socialLinks.linkedin) {
      infoItems.push({
        key: "linkedin",
        label: "LinkedIn",
        value: profile.socialLinks.linkedin,
        icon: "logo-linkedin",
        isLink: true,
        linkUrl: profile.socialLinks.linkedin.startsWith("http")
          ? profile.socialLinks.linkedin
          : `https://linkedin.com/in/${profile.socialLinks.linkedin}`,
      });
    }
    if (profile.socialLinks.github) {
      infoItems.push({
        key: "github",
        label: "Github",
        value: profile.socialLinks.github,
        icon: "logo-github",
        isLink: true,
        linkUrl: profile.socialLinks.github.startsWith("http")
          ? profile.socialLinks.github
          : `https://github.com/${profile.socialLinks.github}`,
      });
    }
  }

  const handleLinkPress = (url: string) => {
    Linking.openURL(url).catch((err) =>
      console.error("Failed to open URL:", err),
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>About</Text>

      {infoItems.map((item) => (
        <InfoItem
          key={item.key}
          icon={item.icon}
          label={item.label}
          value={item.value}
          isLink={item.isLink}
          onPress={
            item.isLink ? () => handleLinkPress(item.linkUrl!) : undefined
          }
        />
      ))}
    </View>
  );
}

// Update InfoItem Component
interface InfoItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLink?: boolean;
  onPress?: () => void;
}

function InfoItem({ icon, label, value, isLink, onPress }: InfoItemProps) {
  const ItemWrapper = isLink ? TouchableOpacity : View;

  return (
    <ItemWrapper
      style={styles.infoItem}
      onPress={onPress}
      activeOpacity={isLink ? 0.7 : 1}
    >
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={20} color={"#6b7280"} />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text
          style={[styles.infoValue, isLink && styles.linkValue]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
      {isLink && (
        <Ionicons
          name="open-outline"
          size={16}
          color="#8b5cf6"
          style={styles.linkIcon}
        />
      )}
    </ItemWrapper>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  infoIcon: {
    width: 32,
    alignItems: "center",
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    color: "#6b7280",
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
    lineHeight: 22,
  },
  linkValue: {
    color: "#8b5cf6",
    textDecorationLine: "underline",
  },
  linkIcon: {
    marginLeft: 8,
    alignSelf: "center",
  },
});
