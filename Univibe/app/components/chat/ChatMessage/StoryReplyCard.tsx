import React from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface StoryReplyCardProps {
  message: any;
  isOwnMessage: boolean;
  getFullImageUrl: (url: string) => string;
  onPress: () => void;
  onLongPress?: (event: any) => void;
}

export const StoryReplyCard = React.memo(
  ({
    message,
    isOwnMessage,
    getFullImageUrl,
    onPress,
    onLongPress,
  }: StoryReplyCardProps) => {
    const storyImageUrl =
      message.story?.thumbnailUrl || message.story?.mediaUrl;
    const fullStoryImageUrl = storyImageUrl
      ? getFullImageUrl(storyImageUrl)
      : null;

    const labelText = isOwnMessage
      ? "You replied to their story"
      : `${message.senderName?.split(" ")[0]}'s moment`;

    return (
      <View
        style={[
          styles.container,
          isOwnMessage ? styles.containerOwn : styles.containerOther,
        ]}
      >
        {/* Connection Line / Label */}
        <View
          style={[
            styles.headerRow,
            isOwnMessage ? styles.headerRowOwn : styles.headerRowOther,
          ]}
        >
          <Ionicons
            name={isOwnMessage ? "arrow-redo" : "arrow-undo"}
            size={12}
            color="#8E8E93"
          />
          <Text style={styles.headerText}>{labelText}</Text>
        </View>

        <Pressable
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={300}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          {/* Story Thumbnail */}
          <View style={styles.imageContainer}>
            {fullStoryImageUrl ? (
              <Image
                source={{ uri: fullStoryImageUrl }}
                style={styles.image}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.placeholder}>
                <Ionicons name="images-outline" size={24} color="#AEAEB2" />
              </View>
            )}

            {/* Dark Gradient Overlay (Simulated with View) */}
            <View style={styles.overlay} />
          </View>
        </Pressable>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
    maxWidth: "85%",
  },
  containerOwn: {
    alignSelf: "flex-end",
  },
  containerOther: {
    alignSelf: "flex-start",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 4,
    opacity: 0.8,
  },
  headerRowOwn: {
    flexDirection: "row-reverse",
  },
  headerRowOther: {
    marginLeft: 4,
  },
  headerText: {
    fontSize: 11,
    fontFamily: "SofiaSans-Medium",
    color: "#8E8E93",
  },
  card: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#F2F2F7",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  imageContainer: {
    width: 140,
    height: 190,
    position: "relative",
    overflow: "hidden",
    borderRadius: 18,
  },
  image: {
    width: "100%",
    height: "100%",
    position: "absolute",
  },
  placeholder: {
    width: "100%",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E5E5EA",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
});

export default StoryReplyCard;
