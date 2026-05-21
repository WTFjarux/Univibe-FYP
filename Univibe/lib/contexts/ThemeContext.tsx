import React, { createContext, useState, useEffect, useContext } from "react";
import { Appearance } from "react-native";

type ThemeContextType = {
  isDark: boolean;
  toggleTheme: () => void;
  colors: typeof lightColors;
};

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export const lightColors = {
  background: "#f8fafc",
  card: "#ffffff",
  text: "#111827",
  textSecondary: "#6b7280",
  textMuted: "#9ca3af",
  border: "#f3f4f6",
  primary: "#8b5cf6",
  primaryLight: "#f3e8ff",
  icon: "#374151",
  skeleton: "#f3f4f6",
  skeletonHighlight: "#e5e7eb",
  eventCardBg: "#ffffff",
  eventCardBorder: "#f3f4f6",
  headerBorder: "#f8fafc",
  shadow: "#000",
  badgeText: "#ffffff",
  logoText: "#111827",
};

export const darkColors = {
  background: "#0e0e0e", 
  card: "#1e1e1e", 
  text: "#f1f5f9", 
  textSecondary: "#94a3b8", 
  textMuted: "#64748b", 
  border: "#3b3b3b", 
  primary: "#a78bfa", 
  primaryLight: "#2d1b69", 
  icon: "#cbd5e1", 
  skeleton: "#1f2020",
  skeletonHighlight: "#525253",
  eventCardBg: "#131212",
  eventCardBorder: "#323942",
  headerBorder: "#1e293b",
  shadow: "#000000",
  badgeText: "#ffffff",
  logoText: "#f1f5f9",
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDark, setIsDark] = useState(Appearance.getColorScheme() === "dark");

  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setIsDark(colorScheme === "dark");
    });
    return () => subscription.remove();
  }, []);

  const toggleTheme = () => setIsDark((prev) => !prev);
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
