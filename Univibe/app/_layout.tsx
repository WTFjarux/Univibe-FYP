// app/_layout.tsx
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { SplashScreen } from "expo-router";
import { AuthProvider } from "../lib/AuthContext";
import { ProfileProvider } from "../lib/ProfileContext";
import { View, ActivityIndicator } from "react-native";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Sofia-Regular": require("../assets/fonts/Sofia-Regular.ttf"),
    "SofiaSans-Regular": require("../assets/fonts/SofiaSans-Regular.ttf"),
    "SofiaSans-Bold": require("../assets/fonts/SofiaSans-Bold.ttf"),
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <ProfileProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Public routes - don't require auth */}
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />

          {/* Protected routes - require auth */}
          <Stack.Screen name="(tabs)" />
          {/* Add other protected screens here */}
        </Stack>
      </ProfileProvider>
    </AuthProvider>
  );
}
