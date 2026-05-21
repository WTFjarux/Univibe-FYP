import { LogBox, Platform, View, ActivityIndicator } from "react-native";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "../lib/contexts/AuthContext";
import { ProfileProvider } from "../lib/contexts/ProfileContext";
import { ChatProvider } from "../lib/contexts/ChatContext";
import { ActiveRoomProvider } from "../lib/contexts/ActiveRoomContext";
import { InAppNotificationProvider } from "../lib/contexts/InAppNotificationContext";
import { useInAppNotifications } from "../hooks/useInAppNotifications";
import InAppToast from "./components/InAppToast";

if (__DEV__) {
  // Suppress specific library noise cleanly
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("expo-av")) {
      return;
    }
    originalWarn(...args);
  };
}

SplashScreen.preventAutoHideAsync();

// 2. Safe Global Event Tracker Lifecycle Hook
function NotificationListener() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <NotificationListenerInner />;
  }
  return null;
}

function NotificationListenerInner() {
  // Executes in its own isolated visual bubble safely without messing up Metro module trees
  useInAppNotifications();
  return null;
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Sofia-Regular": require("../assets/fonts/Sofia-Regular.ttf"),
    "SofiaSans-Regular": require("../assets/fonts/SofiaSans-Regular.ttf"),
    "SofiaSans-Bold": require("../assets/fonts/SofiaSans-Bold.ttf"),
    "SofiaSans-SemiBold": require("../assets/fonts/SofiaSans-SemiBold.ttf"),
    "SofiaSans-Medium": require("../assets/fonts/SofiaSans-Medium.ttf"),
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <ProfileProvider>
            <ChatProvider>
              <ActiveRoomProvider>
                <InAppNotificationProvider>
                  {/* Background Event Infrastructure Hooks */}
                  <NotificationListener />

                  {/* Navigation Manifest */}
                  <Stack screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="index" />
                    <Stack.Screen
                      name="(auth)"
                      options={{ gestureEnabled: false }}
                    />
                    <Stack.Screen
                      name="verify"
                      options={{
                        presentation: "modal",
                        animation: "slide_from_bottom",
                      }}
                    />
                    <Stack.Screen
                      name="(tabs)"
                      options={{ gestureEnabled: false }}
                    />
                    <Stack.Screen name="profile" />
                    <Stack.Screen
                      name="screens/CreateStoryScreen"
                      options={{
                        headerShown: false,
                        presentation: "fullScreenModal",
                        animation: "fade",
                      }}
                    />
                    <Stack.Screen
                      name="screens/StoryViewerScreen"
                      options={{
                        headerShown: false,
                        presentation: "fullScreenModal",
                        animation: "fade",
                      }}
                    />
                    <Stack.Screen
                      name="screens/ChatScreen"
                      options={{ headerShown: false, presentation: "card" }}
                    />
                    <Stack.Screen
                      name="screens/ChatListScreen"
                      options={{ headerShown: false, presentation: "card" }}
                    />
                    <Stack.Screen
                      name="screens/GroupInfoScreen"
                      options={{
                        headerShown: false,
                        presentation: "card",
                        animation: "slide_from_right",
                      }}
                    />
                    <Stack.Screen
                      name="screens/notifications"
                      options={{
                        headerShown: false,
                        presentation: "card",
                        animation: "slide_from_right",
                      }}
                    />
                  </Stack>

                  {/* Global Overlays */}
                  <InAppToast />
                </InAppNotificationProvider>
              </ActiveRoomProvider>
            </ChatProvider>
          </ProfileProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
