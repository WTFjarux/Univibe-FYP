// app/(tabs)/_layout.tsx - UPDATED WITH AUTH
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../lib/AuthContext";
import { View, ActivityIndicator } from "react-native";

export default function TabLayout() {
  const { isLoading, token } = useAuth();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  // If no token, redirect to login
  if (!token) {
    console.log("🚫 No token in tabs layout, redirecting to login");
    return <Redirect href="./landingPage" />;
  }

  // User is authenticated, show tabs
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
          fontWeight: "500", // Changed from number to string
        },
        tabBarIconStyle: {
          marginBottom: 5,
        },
      }}
    >
      {/* Regular tab screens */}
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
