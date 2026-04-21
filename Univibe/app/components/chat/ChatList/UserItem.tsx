// app/components/chat/ChatList/UserItem.tsx

import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { getAvatarUrl, getInitials } from "../../../../lib/utils/chatUtils";

interface UserItemProps {
  user: {
    _id: string;
    name: string;
    username?: string;
    profilePicture?: string;
  };
  onPress: () => void;
}

const UserItem = ({ user, onPress }: UserItemProps) => (
  <TouchableOpacity style={styles.userItem} onPress={onPress}>
    {user.profilePicture ? (
      <Image
        source={{ uri: getAvatarUrl(user.profilePicture) }}
        style={styles.userAvatar}
      />
    ) : (
      <View style={styles.userAvatarPlaceholder}>
        <Text style={styles.userAvatarText}>{getInitials(user.name)}</Text>
      </View>
    )}
    <View style={styles.userInfo}>
      <Text style={styles.userName}>{user.name}</Text>
      <Text style={styles.userUsername}>@{user.username}</Text>
    </View>
  </TouchableOpacity>
);

// Export both named and default
export { UserItem };
export default UserItem;

const styles = StyleSheet.create({
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userAvatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  userAvatarText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#000",
  },
  userUsername: {
    fontSize: 14,
    color: "#8E8E93",
    marginTop: 2,
  },
});
