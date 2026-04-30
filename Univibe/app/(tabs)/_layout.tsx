// app/(tabs)/_layout.tsx

import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/contexts/AuthContext";
import { View, ActivityIndicator, Text } from "react-native";

export default function TabLayout() {
  const { isLoading, token, user } = useAuth();

  // Show loading screen while checking auth
  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#fff",
        }}
      >
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={{ marginTop: 12, color: "#6b7280" }}>Loading...</Text>
      </View>
    );
  }

  // If no token, redirect to landing page
  if (!token) {
    console.log("🚫 No token, redirecting to landing page");
    return <Redirect href="/screens/landingPage" />;
  }

  // If email not verified, redirect to login
  if (!user?.isEmailVerified) {
    console.log("🚫 Email not verified, redirecting to login");
    return <Redirect href="/(auth)/login" />;
  }

  // ✅ If profile not complete, redirect to setup
  if (user?.profileComplete === false) {
    console.log("🚫 Profile not complete, redirecting to setup");
    return <Redirect href="/(auth)/setup-profile" />;
  }

  // User is fully authenticated, verified, and has completed profile
  console.log("✅ User fully authenticated - showing tabs");
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#ffffff",
          borderTopWidth: 1,
          borderTopColor: "#e5e7eb",
          height: 85,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#8b5cf6",
        tabBarInactiveTintColor: "#000000ff",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
          fontFamily: "SofiaSans-Bold",
        },
        tabBarIconStyle: {
          marginBottom: 5,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="feed/index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="newspaper" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="search/index"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="events/index"
        options={{
          title: "Events",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
