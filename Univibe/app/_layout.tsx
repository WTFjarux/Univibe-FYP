// app/_layout.tsx
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { SplashScreen } from "expo-router";
import { AuthProvider } from "../lib/contexts/AuthContext";
import { ProfileProvider } from "../lib/contexts/ProfileContext";
import { ChatProvider } from "../lib/contexts/ChatContext";
import { View, ActivityIndicator } from "react-native";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

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
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <ChatProvider>
            <Stack screenOptions={{ headerShown: false }}>
              {/* Public routes - don't require auth */}
              <Stack.Screen name="index" />
              <Stack.Screen name="(auth)" />

              {/* Verification route - modal presentation */}
              <Stack.Screen
                name="verify"
                options={{
                  presentation: "modal",
                  animation: "slide_from_bottom",
                }}
              />

              {/* Profile routes - includes both index and dynamic [id] */}
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="profile" />

              {/* Chat screens */}
              <Stack.Screen
                name="screens/ChatScreen"
                options={{
                  headerShown: false,
                  presentation: "card",
                }}
              />
              <Stack.Screen
                name="screens/ChatListScreen"
                options={{
                  headerShown: false,
                }}
              />
            </Stack>
          </ChatProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
