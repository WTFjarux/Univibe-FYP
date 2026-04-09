// app/components/Profile/OptimizedImage.tsx (Simplified - no caching)
import React, { useState } from "react";
import { Image, View, ActivityIndicator, StyleSheet } from "react-native";

interface OptimizedImageProps {
  uri: string;
  style?: any;
  thumbnail?: boolean;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  uri,
  style,
  thumbnail = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  if (!uri) {
    return (
      <View style={[styles.placeholderContainer, style]}>
        <ActivityIndicator size="small" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <View style={style}>
      {loading && (
        <View style={[styles.loadingOverlay, StyleSheet.absoluteFillObject]}>
          <ActivityIndicator
            size={thumbnail ? "small" : "large"}
            color="#8b5cf6"
          />
        </View>
      )}
      <Image
        source={{ uri }}
        style={style}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setError(true);
          setLoading(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
  placeholderContainer: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
  },
});

export default OptimizedImage;