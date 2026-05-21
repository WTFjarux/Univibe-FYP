// app/settings/index.tsx

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Linking,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Href } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../lib/contexts/ThemeContext";

interface SettingsScreenProps {
  onLogout: () => void;
  userId: string;
  onClose: () => void;
  onNavigate?: (screen: Href) => void;
}

export default function SettingsScreen({
  onLogout,
  userId,
  onClose,
  onNavigate,
}: SettingsScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await SecureStore.getItemAsync(
        `settings_${userId}`,
      );
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setNotifications(settings.notifications ?? true);
        setEmailNotifications(settings.emailNotifications ?? true);
        setPushNotifications(settings.pushNotifications ?? true);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSetting = async (key: string, value: any) => {
    try {
      const settings = {
        notifications,
        emailNotifications,
        pushNotifications,
        [key]: value,
      };
      await SecureStore.setItemAsync(
        `settings_${userId}`,
        JSON.stringify(settings),
      );
    } catch (error) {
      console.error("Error saving setting:", error);
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    setNotifications(value);
    await saveSetting("notifications", value);
    if (value) {
      Alert.alert(
        "Notifications",
        "You'll receive notifications about activity. You can manage notification preferences in your device settings.",
        [{ text: "OK" }],
      );
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      "Clear Cache",
      "This will clear all cached data. Your app data will be refreshed on next launch.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync(`settings_${userId}`);
              Alert.alert("Success", "Cache cleared successfully");
            } catch (error) {
              Alert.alert("Error", "Failed to clear cache");
            }
          },
        },
      ],
    );
  };

  const handleDataDownload = async () => {
    setLoading(true);
    try {
      Alert.alert("Coming Soon", "Data export feature will be available soon");
    } catch (error) {
      Alert.alert("Error", "Failed to download data");
    } finally {
      setLoading(false);
    }
  };

  const navigateToScreen = (screen: Href) => {
    onClose();
    if (onNavigate) {
      onNavigate(screen);
    } else {
      setTimeout(() => router.push(screen), 300);
    }
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <View
      style={[
        styles.section,
        { backgroundColor: colors.card, shadowColor: colors.shadow },
      ]}
    >
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
        {title}
      </Text>
      <View style={[styles.sectionContent, { borderTopColor: colors.border }]}>
        {children}
      </View>
    </View>
  );

  const renderSettingItem = (
    icon: string,
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    description?: string,
  ) => (
    <View style={[styles.settingItem, { borderBottomColor: colors.border }]}>
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={22} color={colors.textSecondary} />
        </View>
        <View style={styles.settingItemText}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>
            {label}
          </Text>
          {description && (
            <Text
              style={[
                styles.settingDescription,
                { color: colors.textSecondary },
              ]}
            >
              {description}
            </Text>
          )}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.skeletonHighlight, true: colors.primary }}
        thumbColor={colors.card}
      />
    </View>
  );

  const renderActionItem = (
    icon: string,
    label: string,
    onPress: () => void,
    iconColor?: string,
    showArrow: boolean = true,
    badge?: number,
  ) => (
    <TouchableOpacity
      style={[styles.actionItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
    >
      <View style={styles.settingItemLeft}>
        <View style={styles.iconContainer}>
          <Ionicons
            name={icon as any}
            size={22}
            color={iconColor || colors.textSecondary}
          />
        </View>
        <Text
          style={[
            styles.actionLabel,
            iconColor ? { color: iconColor } : { color: colors.text },
          ]}
        >
          {label}
        </Text>
        {badge !== undefined && badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: colors.background },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={colors.card}
      />

      <View
        style={[
          styles.header,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Settings
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Account Settings */}
        {renderSection(
          "Account",
          <>
            {renderActionItem("person-outline", "Account Information", () =>
              navigateToScreen("/profile/edit" as Href),
            )}
            {renderActionItem("lock-closed-outline", "Change Password", () =>
              navigateToScreen("/settings/change-password" as Href),
            )}
            {renderActionItem("person-remove-outline", "Blocked Users", () =>
              navigateToScreen("/settings/blocked-users" as Href),
            )}
            {renderActionItem("volume-off-outline", "Muted Users", () =>
              navigateToScreen("/settings/muted-users" as Href),
            )}
          </>,
        )}

        {/* Content Management */}
        {renderSection(
          "Content Management",
          <>
            {renderActionItem("bookmark-outline", "Saved Posts", () =>
              navigateToScreen("/settings/saved-posts" as Href),
            )}
            {renderActionItem("eye-off-outline", "Hidden Posts", () =>
              navigateToScreen("/settings/hidden-posts" as Href),
            )}
            {renderActionItem("trash-outline", "Deleted Posts", () =>
              navigateToScreen("/settings/deleted-posts" as Href),
            )}
          </>,
        )}

        {/* Notifications */}
        {renderSection(
          "Notifications",
          <>
            {renderSettingItem(
              "notifications-outline",
              "Push Notifications",
              pushNotifications,
              setPushNotifications,
              "Receive notifications about activity",
            )}
            {renderSettingItem(
              "mail-outline",
              "Email Notifications",
              emailNotifications,
              setEmailNotifications,
              "Receive updates via email",
            )}
          </>,
        )}

        {/* Preferences */}
        {renderSection(
          "Preferences",
          <>
            <View
              style={[styles.settingItem, { borderBottomColor: colors.border }]}
            >
              <View style={styles.settingItemLeft}>
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={isDark ? "moon" : "moon-outline"}
                    size={22}
                    color={colors.textSecondary}
                  />
                </View>
                <View style={styles.settingItemText}>
                  <Text style={[styles.settingLabel, { color: colors.text }]}>
                    Dark Mode
                  </Text>
                  <Text
                    style={[
                      styles.settingDescription,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {isDark ? "Dark mode is on" : "Light mode is on"}
                  </Text>
                </View>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{
                  false: colors.skeletonHighlight,
                  true: colors.primary,
                }}
                thumbColor={colors.card}
              />
            </View>
            {renderActionItem("language-outline", "Language", () =>
              Alert.alert("Coming Soon", "Language selection coming soon"),
            )}
          </>,
        )}

        {/* Privacy & Security */}
        {renderSection(
          "Privacy & Security",
          <>
            {renderActionItem(
              "shield-checkmark-outline",
              "Privacy Policy",
              () => navigateToScreen("/settings/PrivacyPolicy" as Href),
            )}
            {renderActionItem("document-text-outline", "Terms of Service", () =>
              navigateToScreen("/settings/TermsOfService" as Href),
            )}
            {renderActionItem(
              "download-outline",
              "Download Your Data",
              handleDataDownload,
            )}
            {renderActionItem(
              "trash-outline",
              "Clear Cache",
              handleClearCache,
              "#ef4444",
            )}
          </>,
        )}

        {/* Support */}
        {renderSection(
          "Support",
          <>
            {renderActionItem("help-circle-outline", "Help Center", () =>
              Alert.alert("Coming Soon", "Help center coming soon"),
            )}
            {renderActionItem("chatbubble-outline", "Contact Support", () =>
              Linking.openURL("mailto:univibe.fyp@gmail.com"),
            )}
            {renderActionItem("star-outline", "Rate the App", () =>
              Alert.alert("Coming Soon", "Rate us on the app store"),
            )}
          </>,
        )}

        {/* About */}
        {renderSection(
          "About",
          <>
            <View style={styles.versionContainer}>
              <Text
                style={[styles.versionText, { color: colors.textSecondary }]}
              >
                Version 1.0.0
              </Text>
              <Text style={[styles.copyrightText, { color: colors.textMuted }]}>
                © 2024 Univibe. All rights reserved.
              </Text>
            </View>
          </>,
        )}

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    fontFamily: "SofiaSans-SemiBold",
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionContent: { borderTopWidth: 1, borderTopColor: "#f3f4f6" },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  settingItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconContainer: { width: 32, marginRight: 12 },
  settingItemText: { flex: 1 },
  settingLabel: {
    fontSize: 16,
    color: "#111827",
    fontFamily: "SofiaSans-Regular",
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
  },
  actionItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  actionLabel: {
    fontSize: 16,
    color: "#111827",
    fontFamily: "SofiaSans-Regular",
    flex: 1,
  },
  badge: {
    backgroundColor: "#ef4444",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "SofiaSans-Bold",
  },
  versionContainer: { paddingVertical: 20, alignItems: "center" },
  versionText: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "SofiaSans-Regular",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 16,
    marginTop: 32,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fee2e2",
    gap: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: "600",
    fontFamily: "SofiaSans-SemiBold",
    color: "#ef4444",
  },
  bottomPadding: { height: 30 },
});
