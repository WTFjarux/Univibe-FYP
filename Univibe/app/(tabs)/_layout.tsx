import { Tabs, Redirect, useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/contexts/AuthContext";
import { useTheme } from "../../lib/contexts/ThemeContext";
import {
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  Platform,
} from "react-native";
import { useEffect, useRef } from "react";
import { BlurView } from "expo-blur";

export default function TabLayout() {
  const { isLoading, token, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const prevTokenRef = useRef(token);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (isLoading) return;

    const hadToken = prevTokenRef.current;
    const hasToken = !!token;

    if (hadToken && !hasToken) {
      router.replace("/screens/landingPage");
    } else if (hadToken && hasToken && user && !user.isEmailVerified) {
      router.replace("/(auth)/login");
    }

    prevTokenRef.current = token;
  }, [isLoading, token, user?.isEmailVerified]);

  if (isLoading) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Loading...
        </Text>
      </View>
    );
  }

  if (!token) return <Redirect href="/screens/landingPage" />;
  if (!user?.isEmailVerified) return <Redirect href="/(auth)/login" />;
  if (user?.profileComplete === false)
    return <Redirect href="/(auth)/setup-profile" />;

  // Dynamic tab bar colors based on theme
  const tabBarBackgroundColor = Platform.select({
    ios: isDark ? "rgba(30, 41, 59, 0.85)" : "rgba(255, 255, 255, 0.85)",
    android: isDark ? "#1e293b" : "#ffffff",
  });

  const tabBarBorderColor = isDark
    ? "rgba(255,255,255,0.06)"
    : "rgba(0,0,0,0.06)";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          height: Platform.OS === "ios" ? 92 : 76,
          backgroundColor: tabBarBackgroundColor,
          borderTopWidth: 1,
          borderTopColor: tabBarBorderColor,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 10,
          paddingBottom: Platform.OS === "ios" ? 30 : 14,
          shadowColor: isDark ? "#000" : "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: isDark ? 0.3 : 0.12,
          shadowRadius: 16,
          elevation: 10,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "SofiaSans-Bold",
          marginTop: 4,
          marginBottom: 0,
          fontWeight: "700",
        },
        tabBarIconStyle: {
          marginBottom: 2,
        },
        tabBarBackground: () => (
          <BlurView
            intensity={
              Platform.OS === "ios" ? (isDark ? 80 : 65) : isDark ? 100 : 90
            }
            tint={isDark ? "dark" : "light"}
            style={[
              StyleSheet.absoluteFill,
              {
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                overflow: "hidden",
              },
            ]}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && [
                  styles.focusedIconContainer,
                  { backgroundColor: colors.primary },
                ],
              ]}
            >
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={22}
                color={focused ? "#ffffff" : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="feed/index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && [
                  styles.focusedIconContainer,
                  { backgroundColor: colors.primary },
                ],
              ]}
            >
              <Ionicons
                name={focused ? "newspaper" : "newspaper-outline"}
                size={22}
                color={focused ? "#ffffff" : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="search/index"
        options={{
          title: "Search",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && [
                  styles.focusedIconContainer,
                  { backgroundColor: colors.primary },
                ],
              ]}
            >
              <Ionicons
                name={focused ? "search" : "search-outline"}
                size={22}
                color={focused ? "#ffffff" : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="events/index"
        options={{
          title: "Events",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && [
                  styles.focusedIconContainer,
                  { backgroundColor: colors.primary },
                ],
              ]}
            >
              <Ionicons
                name={focused ? "calendar" : "calendar-outline"}
                size={22}
                color={focused ? "#ffffff" : color}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <View
              style={[
                styles.iconContainer,
                focused && [
                  styles.focusedIconContainer,
                  { backgroundColor: colors.primary },
                ],
              ]}
            >
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={22}
                color={focused ? "#ffffff" : color}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    color: "#6b7280",
    fontFamily: "SofiaSans-Regular",
    fontSize: 14,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  focusedIconContainer: {
    backgroundColor: "#8b5cf6",
    shadowColor: "#8b5cf6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
