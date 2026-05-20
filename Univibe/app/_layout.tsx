
import { LogBox, Platform } from 'react-native';
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider } from "../lib/contexts/AuthContext";
import { ProfileProvider } from "../lib/contexts/ProfileContext";
import { ChatProvider } from "../lib/contexts/ChatContext";
import { ActiveRoomProvider } from "../lib/contexts/ActiveRoomContext";
import { InAppNotificationProvider } from "../lib/contexts/InAppNotificationContext";
import { View, ActivityIndicator} from "react-native";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import InAppToast from "./components/InAppToast";

if (__DEV__) {
  // Suppress expo-av warning
  const originalWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' && 
      args[0].includes('expo-av')
    ) {
      return;
    }
    originalWarn(...args);
  };
}

SplashScreen.preventAutoHideAsync();

// Inline listener component - avoids Expo Router treating it as a route
function NotificationListener() {
  const { useInAppNotifications } = require("../hooks/useInAppNotifications");
  const { useAuth } = require("../lib/contexts/AuthContext");
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <NotificationListenerInner />;
  }
  return null;
}

function NotificationListenerInner() {
  const { useInAppNotifications } = require("../hooks/useInAppNotifications");
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
                  <NotificationListener />

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
